import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Bot, 
  User, 
  History, 
  BookOpen, 
  Settings, 
  LogOut, 
  Search,
  MessageSquare,
  Plus,
  Menu,
  X,
  FileText,
  AlertCircle,
  Database
} from 'lucide-react';
import { useAuth, AuthProvider } from './lib/AuthContext';
import { signIn, logOut, db } from './lib/firebase';
import { getChatResponse } from './lib/gemini';
import { cn, handleFirestoreError, OperationType } from './lib/utils';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, onSnapshot, where, updateDoc, doc } from 'firebase/firestore';
import { Message, QueryRecord, KnowledgeArticle } from './types';
import Markdown from 'react-markdown';

// --- Components ---

function ChatBubble({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-8",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div className={cn(
        "flex max-w-[85%] md:max-w-[80%]",
        isAssistant ? "flex-row" : "flex-row-reverse"
      )}>
        <div className={cn(
          "w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-xs shadow-sm",
          isAssistant ? "bg-slate-900 text-amber-500 mr-3" : "bg-slate-300 text-slate-700 ml-3 rounded-full"
        )}>
          {isAssistant ? "V" : <User size={16} />}
        </div>
        <div className={cn(
          "px-5 py-4 shadow-sm",
          isAssistant 
            ? "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-none" 
            : "bg-blue-600 text-white rounded-2xl rounded-tr-none"
        )}>
          {isAssistant ? (
            <div className="space-y-4">
              {message.text.includes("Verified Solution") && (
                <div className="mb-2 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter bg-amber-50 px-2 py-0.5 rounded">
                    Technical Knowledge Reference
                  </span>
                </div>
              )}
              <div className="prose prose-sm prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-headings:flex prose-headings:items-center prose-headings:gap-2">
                <Markdown
                  components={{
                    h4: ({ children }) => (
                      <h4 className="font-bold flex items-center gap-2 mt-4 first:mt-0">
                        <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                        {children}
                      </h4>
                    ),
                    code: ({ children }) => (
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono text-[0.9em]">
                        {children}
                      </code>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal ml-5 space-y-2 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {children}
                      </ol>
                    )
                  }}
                >
                  {message.text}
                </Markdown>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-tight">Diagnostics Log</button>
                <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-tight">Email Support</button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'staff';

  return (
    <div className="h-full bg-white flex flex-col pt-6">
      <div className="px-6 mb-8">
        <button 
          onClick={() => setActiveTab('chat')}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-all shadow-sm"
        >
          + New Technical Query
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-8 overflow-y-auto">
        <div>
          <h3 className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Core Navigation</h3>
          <ul className="space-y-1">
            {[
              { id: 'chat', label: 'Support Terminal', icon: MessageSquare },
              { id: 'history', label: 'Diagnostic Records', icon: History },
              { id: 'knowledge', label: 'Technical Docs', icon: BookOpen },
            ].map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                    activeTab === item.id 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon size={18} className={activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-600"} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {isStaff && (
          <div>
            <h3 className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Admin Controls</h3>
            <button
              onClick={() => setActiveTab('manage')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'manage' ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Settings size={18} />
              System Management
            </button>
          </div>
        )}

        <div>
          <h3 className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Diagnostics Health</h3>
          <div className="px-2 space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
               <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-2">
                <span className="uppercase">Knowledge Coverage</span>
                <span>94%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-[94%] h-full bg-blue-500"></div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
               <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-2">
                <span className="uppercase">System Load</span>
                <span>12%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-[12%] h-full bg-amber-500"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-6 border-t border-slate-100">
        <button 
          onClick={() => logOut()}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-400 hover:text-red-600 transition-colors uppercase tracking-widest"
        >
          <LogOut size={14} />
          End Session
        </button>
      </div>
    </div>
  );
}

// --- Main Application Pages ---

function ChatView() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize chat session
  useEffect(() => {
    if (!user) return;
    const initChat = async () => {
      try {
        const docRef = await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          status: 'active',
          createdAt: serverTimestamp(),
          lastMessage: ''
        });
        setChatId(docRef.id);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'chats');
      }
    };
    initChat();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !chatId || !user) return;

    const userMessageText = input;
    const userMessage: Message = {
      role: 'user',
      text: userMessageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Persist user message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role: 'user',
        text: userMessageText,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.WRITE, `chats/${chatId}/messages`));

      // 1. Search Knowledge Base and History for context
      const kbQuery = query(collection(db, 'knowledge_base'), limit(10));
      const histQuery = query(collection(db, 'queries'), limit(10));
      
      const [kbSnap, histSnap] = await Promise.all([
        getDocs(kbQuery),
        getDocs(histQuery)
      ]);
      
      let context = "";
      kbSnap.forEach(doc => {
        const d = doc.data() as KnowledgeArticle;
        context += `Article Topic: ${d.title}\nContent: ${d.content.slice(0, 1000)}\n\n`;
      });
      histSnap.forEach(doc => {
        const d = doc.data() as QueryRecord;
        context += `Historical Question: ${d.question}\nVerified Solution: ${d.solution}\n\n`;
      });

      // 2. Get Gemini response
      const historyForGemini = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));

      const aiResponseText = await getChatResponse(userMessageText, historyForGemini, context);

      const aiMessage: Message = {
        role: 'assistant',
        text: aiResponseText || "I'm sorry, I couldn't generate a response.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Persist assistant message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role: 'assistant',
        text: aiResponseText,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.WRITE, `chats/${chatId}/messages`));

      // Update chat session last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: userMessageText.slice(0, 100),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `chats/${chatId}`));

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: 'assistant',
        text: "System Error: Diagnostic line interrupted. Interaction logged for engineering review.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Sub Header for Chat Status */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Knowledge Base Pulse: Online</span>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secure Terminal Session #VS-{Math.floor(Math.random()*9000)+1000}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const confirmEscalate = window.confirm("Escalate to human support?");
              if (confirmEscalate) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  text: "System: Your query has been flagged for prioritized escalation. Ref #"+Math.random().toString(36).substr(2, 9).toUpperCase(),
                  timestamp: new Date()
                }]);
              }
            }}
            className="text-[10px] font-bold text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-tight"
          >
            Escalate to Engineering
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center mt-20 text-center">
              <div className="w-20 h-20 bg-white border border-slate-200 text-slate-400 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm">
                <Bot size={40} />
              </div>
              <div className="space-y-4 max-w-sm">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase italic">Awaiting technical <br/> enquiry...</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Enter a symptom, error code, or wiring question to query the Vsmart training data.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl mt-12">
                {[
                  "PID controller hunting Troubleshooting",
                  "VT-X Series Modbus Register Map",
                  "Wiring for Type-K Thermocouple",
                  "PLC Modbus RTU Communication Error"
                ].map((suggestion, i) => (
                  <button 
                    key={i}
                    onClick={() => { setInput(suggestion); }}
                    className="text-left px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50/20 transition-all uppercase tracking-wide flex items-center gap-3 group"
                  >
                    <Search size={14} className="text-slate-400 group-hover:text-blue-500" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <ChatBubble key={i} message={m} />)
          )}
          {isLoading && (
            <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-14 bg-white/50 py-2 px-4 rounded-full border border-slate-100 w-fit">
              <span className="flex gap-1.5">
                 <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                 <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                 <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </span>
              Querying Diagnostic Database
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-6 py-6 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4 items-end bg-slate-50 border border-slate-200 rounded-[1.5rem] p-3 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all shadow-sm">
            <button className="p-3 text-slate-400 hover:text-slate-600 transition-colors">
              <Plus size={20} />
            </button>
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Enter technical query, sensor model, or error code..."
              className="flex-1 bg-transparent border-none resize-none focus:ring-0 p-3 text-sm font-medium text-slate-700 placeholder:text-slate-400"
              style={{ maxHeight: '200px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "w-12 h-12 rounded-xl transition-all flex items-center justify-center",
                input.trim() && !isLoading ? "bg-slate-900 text-amber-500 shadow-lg shadow-slate-200" : "bg-slate-200 text-slate-400"
              )}
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-4 italic font-medium">
            AI assistance provided as a secondary reference. Always verify wiring against Vsmart hardware specifications.
          </p>
        </div>
      </div>
    </div>
  );
}

function HistoryView() {
  const [queries, setQueries] = useState<QueryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    try {
      const q = query(collection(db, 'queries'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setQueries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueryRecord)));
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'queries'));
      return unsubscribe;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'queries');
    }
  }, []);

  const filtered = queries.filter(q => 
    q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.solution.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10 space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic leading-none">Diagnostic Records</h2>
        <p className="text-slate-500 font-medium text-sm">Historical technical solutions and verified field resolutions.</p>
      </div>

      <div className="flex gap-4 mb-10">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Filter by symptom, model, or error code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm font-medium text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {filtered.map((item) => (
          <motion.div 
            layout
            key={item.id} 
            className="bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-blue-200 transition-all relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-6">
               <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-[0.15em] rounded-lg">
                {item.category}
               </span>
            </div>
            <div className="mb-6">
              <h3 className="font-bold text-lg text-slate-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                {item.question}
              </h3>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                 <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  Verified: {new Date(item.createdAt?.toDate()).toLocaleDateString('en-IN')}
                 </p>
              </div>
            </div>
            <div className="prose prose-sm text-slate-600 max-w-none line-clamp-3 mb-8">
              <Markdown>{item.solution}</Markdown>
            </div>
            <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
              <div className="flex flex-wrap gap-2">
                 {item.tags.map(tag => (
                   <span key={tag} className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-600 font-bold uppercase tracking-widest rounded border border-blue-100/50">
                     {tag}
                   </span>
                 ))}
              </div>
              <button className="p-2 bg-slate-900 text-amber-500 rounded-lg hover:bg-slate-800 transition-all">
                <Search size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeView() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);

  useEffect(() => {
    try {
      const q = query(collection(db, 'knowledge_base'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setArticles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnowledgeArticle)));
      }, (e) => handleFirestoreError(e, OperationType.LIST, 'knowledge_base'));
      return unsubscribe;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'knowledge_base');
    }
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row border-b border-slate-100 pb-12 gap-10">
        <div className="flex-1 space-y-4">
          <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest rounded-full">Company Authoritative Sources</div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-[0.9]">
            Vsmart <br/> Technical <span className="text-blue-600">Library</span>
          </h2>
          <p className="text-slate-500 max-w-sm text-sm font-medium leading-relaxed">
            Consolidated repository for product wiring schemas, calibration SOPs, and system specifications.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Manuals', count: articles.filter(a => a.type === 'manual').length, color: 'bg-blue-600' },
            { label: 'Specs', count: articles.filter(a => a.type === 'spec').length, color: 'bg-amber-500' },
            { label: 'SOPs', count: articles.filter(a => a.type === 'sop').length, color: 'bg-emerald-600' },
            { label: 'Guides', count: articles.filter(a => a.type === 'guide').length, color: 'bg-slate-900' },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-slate-200 p-5 rounded-3xl w-36 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">{stat.label}</div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-black text-slate-900 leading-none">{stat.count}</div>
                <div className={cn("h-4 w-1.5 mb-1 rounded-full", stat.color)}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
        {articles.map((article) => (
          <div key={article.id} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-8 hover:-translate-y-1 transition-all group cursor-pointer hover:border-blue-200 flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <FileText size={20} />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">{article.type}</span>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-4 leading-tight group-hover:text-blue-600">{article.title}</h3>
            <div className="text-sm text-slate-500 line-clamp-3 mb-8 flex-1 leading-relaxed">
              {article.content}
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-slate-50">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Rev: {new Date(article.createdAt?.toDate()).getMonth() + 1}/{new Date(article.createdAt?.toDate()).getFullYear().toString().substr(-2)}
              </div>
              <button className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline">Access Document</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManagementView() {
  const [activeSubTab, setActiveSubTab] = useState<'queries' | 'knowledge'>('queries');
  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Forms state
  const [qForm, setQForm] = useState({ question: '', solution: '', category: 'General', tags: '' });
  const [kForm, setKForm] = useState({ title: '', content: '', type: 'manual' as any });

  const seedData = async () => {
    if (!window.confirm("Initialize diagnostic database with Vsmart authoritative data?")) return;
    setIsSeeding(true);
    try {
      const kbArticles = [
        {
          title: "VT-X Series Wiring Guide",
          type: "manual",
          content: "Wiring J7 Terminal: J7 is the primary sensor input terminal. Pin 1: + (Hot), Pin 2: - (Common). For Type-K Thermocouples, ensure yellow wire is Hot. Loop resistance should not exceed 50 ohms. Shield should be grounded at terminal J9 ONLY to prevent ground loops. Modbus RS485 communication utilizes terminal J10. Pin A (+), Pin B (-), Ground (G)."
        },
        {
          title: "SOP: Type-K Thermocouple Calibration",
          type: "sop",
          content: "1. Navigate to MENU > CALIBRATION. 2. Ensure CJC (Cold Junction Compensation) is enabled. 3. Apply 0°C ice bath to sensor. 4. Wait for stability (approx 5 mins). 5. Adjust OFFSET until readout is 0.0 ±0.1. 6. Repeat with boiling water (100°C) and adjust SPAN factor."
        },
        {
          title: "Modbus RTU RT-01 Specifications",
          type: "spec",
          content: "Baud Rate: 9600 (Default), 19200, 38400. Parity: None (1 stop bit). Address Range: 1-247. Register 40001: Process Variable (PV). Register 40002: Setpoint (SP). Register 40003: Control Output (%). Write access restricted to registers 40002-40200."
        }
      ];

      for (const art of kbArticles) {
        await addDoc(collection(db, 'knowledge_base'), { ...art, createdAt: serverTimestamp() })
          .catch(e => handleFirestoreError(e, OperationType.WRITE, 'knowledge_base'));
      }

      const historyQueries = [
        {
          question: "VT-9000 controller showing ERR-04 and relay stuck open",
          solution: "#### Problem Understanding\nError code 'ERR-04' indicates a **Safety High-Limit Cutoff** trigger.\n\n#### Possible Causes\n- Process temperature exceeded `SAFETY_MAX`.\n- Internal safety relay fuse blown (F2).\n- Open-loop sensor condition.\n\n#### Recommended Solution\n1. Reset high-limit via `MENU > SAFETY > RESET`.\n2. Check J7 for voltage continuity.\n3. Verify CJC offset.",
          category: "Hardware",
          tags: ["ERR-04", "VT-9000", "Relay", "Safety"]
        },
        {
          question: "Modbus communication error on VT-X Series",
          solution: "Check J10 wiring (A/B reversed is common). Ensure baud rate matches (default 9600). Verify termination resistor (120 Ohm) is present if at end of segment.",
          category: "Communication",
          tags: ["Modbus", "RS485", "VT-X"]
        }
      ];

      for (const q of historyQueries) {
        await addDoc(collection(db, 'queries'), { ...q, createdAt: serverTimestamp() })
          .catch(e => handleFirestoreError(e, OperationType.WRITE, 'queries'));
      }

      alert("Vsmart Diagnostic Database successfully initialized.");
    } catch (e) {
      console.error(e);
      alert("Error seeding data.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'queries'), {
        ...qForm,
        tags: qForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: serverTimestamp(),
      });
      setQForm({ question: '', solution: '', category: 'General', tags: '' });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'queries');
    }
  };

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'knowledge_base'), {
        ...kForm,
        createdAt: serverTimestamp(),
      });
      setKForm({ title: '', content: '', type: 'manual' });
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'knowledge_base');
    }
  };

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      <div className="px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div className="space-y-6">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Management <span className="text-blue-600">Console</span></h2>
            <div className="flex gap-2">
              {[
                { id: 'queries', label: 'Problem Records' },
                { id: 'knowledge', label: 'Technical Docs' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] border transition-all",
                    activeSubTab === tab.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                      : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={seedData}
              disabled={isSeeding}
              className="flex items-center gap-3 bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50"
            >
              <Database size={16} />
              {isSeeding ? 'Seeding...' : 'Seed Vsmart Data'}
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200 transition-all active:scale-[0.98]"
            >
              <Plus size={20} />
              Register New {activeSubTab === 'queries' ? 'Case' : 'Doc'}
            </button>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 border-dashed rounded-[3rem] p-16 flex flex-col items-center justify-center min-h-[460px] text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-8">
            <Search size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight uppercase">Authorized Database Access</h3>
          <p className="text-slate-500 max-w-sm text-sm font-medium leading-relaxed">
            Expand the Vsmart training set by adding verified solutions or technical documentation. Updated records are immediately available to the AI Engine.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] p-12 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
              
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Register <span className="text-blue-600">{activeSubTab === 'queries' ? 'Diagnostic Solution' : 'Technical Reference'}</span></h3>
                <button onClick={() => setIsAdding(false)} className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {activeSubTab === 'queries' ? (
                <form onSubmit={handleAddQuery} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Technical Symptom / Question</label>
                    <input 
                      required
                      value={qForm.question}
                      onChange={e => setQForm({...qForm, question: e.target.value})}
                      placeholder="e.g. PID Controller ERR-02 Calibration"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Verified Resolution (Markdown)</label>
                    <textarea 
                      required
                      rows={5}
                      value={qForm.solution}
                      onChange={e => setQForm({...qForm, solution: e.target.value})}
                      placeholder="Detail the step-by-step resolution..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all resize-none font-mono text-sm" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Category</label>
                      <select 
                        value={qForm.category}
                        onChange={e => setQForm({...qForm, category: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none font-bold text-xs uppercase"
                      >
                        <option>Communication</option>
                        <option>Hardware</option>
                        <option>Wiring</option>
                        <option>Calibration</option>
                        <option>Software</option>
                        <option>General</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Search Identifiers (Comma Split)</label>
                      <input 
                        value={qForm.tags}
                        onChange={e => setQForm({...qForm, tags: e.target.value})}
                        placeholder="modbus, plc, vsmart-gen3"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium" 
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.99]">
                    Commit Solution to Database
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddKnowledge} className="space-y-8">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Source Title</label>
                    <input 
                      required
                      value={kForm.title}
                      onChange={e => setKForm({...kForm, title: e.target.value})}
                      placeholder="VT-X Operation Manual v4.0"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all font-medium" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Internal Reference Type</label>
                    <select 
                      value={kForm.type}
                      onChange={e => setKForm({...kForm, type: e.target.value as any})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none font-bold text-xs uppercase"
                    >
                      <option value="manual">Manual</option>
                      <option value="spec">Specification</option>
                      <option value="sop">SOP</option>
                      <option value="guide">Guide</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Structured Content Body</label>
                    <textarea 
                      required
                      rows={8}
                      value={kForm.content}
                      onChange={e => setKForm({...kForm, content: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all resize-none text-sm leading-relaxed" 
                    />
                  </div>
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.99]">
                    Publish to Knowledge Library
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MainLayout() {
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900 border-none outline-none">
      <div className="flex flex-col flex-1 relative overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-slate-900 text-white shrink-0 border-b border-slate-800 z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center font-black text-slate-900 shadow-inner">
              V
            </div>
            <div>
              <h1 className="text-sm md:text-lg font-bold leading-none tracking-tight">
                Vsmart Thermotech <span className="text-amber-400 uppercase italic text-[0.8em]">AI Support System</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 border-l border-slate-800 pl-6">
              <div className="text-right">
                <p className="text-xs font-bold text-white leading-tight">{profile?.displayName || 'User'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-tighter font-medium">{profile?.role || 'Guest'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <User size={18} />
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Overlay */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60]"
              />
            )}
          </AnimatePresence>

          {/* Sidebar (Drawer) */}
          <aside className={cn(
            "fixed inset-y-0 left-0 z-[70] w-72 bg-white transition-transform duration-300 transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-slate-900">System Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-900">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }} />
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 h-full overflow-hidden relative bg-slate-900 md:p-2 md:pt-0">
             <div className="h-full w-full bg-white md:rounded-tl-[3rem] overflow-hidden shadow-2xl">
              <AnimatePresence mode="wait">
                {activeTab === 'chat' && (
                  <motion.div 
                    key="chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <ChatView />
                  </motion.div>
                )}
                {activeTab === 'history' && (
                  <motion.div 
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full overflow-y-auto"
                  >
                    <HistoryView />
                  </motion.div>
                )}
                {activeTab === 'knowledge' && (
                  <motion.div 
                    key="knowledge"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-full overflow-y-auto"
                  >
                    <KnowledgeView />
                  </motion.div>
                )}
                {activeTab === 'manage' && (
                  <motion.div 
                    key="manage"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    className="h-full"
                  >
                    <ManagementView />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function AuthView() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signIn();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Structural Decor */}
      <div className="absolute top-0 left-0 w-full h-[30%] bg-gradient-to-b from-slate-900 to-transparent"></div>
      <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-blue-600/10 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-amber-600/10 blur-[150px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl relative z-10"
      >
        <div className="bg-white border border-slate-200 rounded-[3.5rem] p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-blue-600 to-slate-900"></div>
          
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-amber-500 text-4xl font-black mx-auto mb-12 shadow-xl">
            V
          </div>
          
          <div className="text-center space-y-6 mb-16">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              Technical <br/> <span className="text-blue-600">Support System</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
              Vsmart Thermotech Pvt Ltd.
            </p>
            <div className="h-px w-20 bg-slate-100 mx-auto"></div>
            <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed font-medium">
              Authorized access only. Use company credentials to initiate support diagnostics.
            </p>
          </div>

          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-slate-800 transition-all shadow-xl group border-2 border-transparent hover:border-slate-700"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-700 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <div className="flex gap-1.5 items-center">
                   <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                   <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                </div>
                Connect to Knowledge Stream
              </>
            )}
          </button>
        </div>
        
        <div className="flex justify-between items-center px-10 mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-60">
           <span>Diagnostic Engine v2.4</span>
           <span>© 2024 Vsmart Thermotech</span>
        </div>
      </motion.div>
    </div>
  );
}

function Content() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full bg-neutral-950 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-orange-600 rounded-2xl"
        ></motion.div>
      </div>
    );
  }

  return user ? <MainLayout /> : <AuthView />;
}

export default function App() {
  return (
    <AuthProvider>
      <Content />
    </AuthProvider>
  );
}
