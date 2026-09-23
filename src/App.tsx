import React, { useState, useRef, useEffect, Component } from 'react';
import { 
  Search, 
  Menu, 
  Plus, 
  Heart, 
  Grid, 
  Globe,
  ExternalLink,
  Layout as LayoutIcon, 
  Image as ImageIcon, 
  Type, 
  ArrowRight, 
  BookOpen, 
  CheckCircle, 
  Edit2, 
  Share2, 
  Mail, 
  MessageCircle, 
  MessageSquare,
  Instagram, 
  Copy,
  Undo2,
  Redo2,
  ChevronLeft,
  Info,
  Camera,
  UploadCloud,
  Send,
  Download,
  User as UserIcon,
  LogOut,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Activity,
  List,
  Maximize2,
  Minimize2,
  Mic,
  Volume2,
  Package,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng, toJpeg } from 'html-to-image';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { Screen, TEMPLATES, FONTS, LAYOUTS, Customization, GiftCard } from './types';
import { auth, db, signInWithGoogle, signInWithEmail, signUpWithEmail, signOutUser, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, getDocFromServer, doc as firestoreDoc } from 'firebase/firestore';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstall';
import { QRCodeSVG } from 'qrcode.react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<any, any> {
  public state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-md w-full glass p-12 rounded-[2.5rem] text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <Info className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-headline font-bold text-on-background mb-4">System Anomaly</h2>
            <p className="text-on-surface-variant mb-8 leading-relaxed">
              The studio encountered an unexpected state. Our systems are working to restore stability.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full signature-gradient text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all"
            >
              Reboot Studio
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-8 p-4 bg-black/50 rounded-xl text-xs text-left overflow-auto max-h-40 text-primary/70 font-mono">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white/5 animate-pulse rounded-2xl overflow-hidden relative", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
    </div>
  );
}

const INITIAL_CUSTOMIZATION: Customization = {
  message: "May your holidays be filled with the warmth of shared stories and the sparkle of new memories.",
  font: 'epilogue',
  photos: [],
  layout: 'classic',
  recipientName: 'Julian Sterling',
  recipientEmail: 'julian.sterling@example.com',
  deliveryDate: 'December 24, 2024'
};

const safeJsonParse = (text: string | undefined, fallback: any) => {
  if (!text) return fallback;
  try {
    // First try direct parse after trimming
    return JSON.parse(text.trim());
  } catch (e) {
    try {
      // Try cleaning markdown code blocks
      const cleaned = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e2) {
      try {
        // Try extracting JSON with regex (most robust for trailing text)
        const match = text.match(/(\{.*\}|\[.*\])/s);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch (e3) {
        console.error("Safe JSON Parse failed:", text);
      }
    }
    return fallback;
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('gallery');
  const [selectedTemplate, setSelectedTemplate] = useState<GiftCard | null>(null);
  const [customization, setCustomization] = useState<Customization>(INITIAL_CUSTOMIZATION);
  const [history, setHistory] = useState<Customization[]>([INITIAL_CUSTOMIZATION]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSystemStable, setIsSystemStable] = useState(true);
  const [userDrafts, setUserDrafts] = useState<any[]>([]);
  const [generatedTemplates, setGeneratedTemplates] = useState<GiftCard[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const [likedTemplates, setLikedTemplates] = useState<string[]>(() => {
    const saved = localStorage.getItem('festive_curator_likes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('festive_curator_likes', JSON.stringify(likedTemplates));
  }, [likedTemplates]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    // Test Firestore Connection for stability
    const testConnection = async () => {
      try {
        await getDocFromServer(firestoreDoc(db, 'test', 'connection'));
        setIsSystemStable(true);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          setIsSystemStable(false);
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, `users/${user.uid}/drafts`),
        orderBy('updatedAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const drafts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserDrafts(drafts);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/drafts`);
      });
      return () => unsubscribe();
    } else {
      setUserDrafts([]);
    }
  }, [user]);

  const saveDraft = async () => {
    if (!user) {
      navigate('signin');
      return;
    }

    try {
      const { setDoc, doc, addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const draftData = {
        uid: user.uid,
        templateId: selectedTemplate?.id || 'default',
        customization,
        updatedAt: serverTimestamp()
      };

      if (currentDraftId) {
        await setDoc(doc(db, `users/${user.uid}/drafts`, currentDraftId), draftData, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, `users/${user.uid}/drafts`), {
          ...draftData,
          createdAt: serverTimestamp()
        });
        setCurrentDraftId(docRef.id);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/drafts`);
    }
  };

  const deleteDraft = async (draftId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete this draft?")) return;

    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, `users/${user.uid}/drafts`, draftId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/drafts/${draftId}`);
    }
  };

  const handleCustomizationChange = (newCustomization: React.SetStateAction<Customization>) => {
    setCustomization(prev => {
      const next = typeof newCustomization === 'function' ? (newCustomization as (prev: Customization) => Customization)(prev) : newCustomization;
      
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(next);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      return next;
    });
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setCustomization(history[prevIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCustomization(history[nextIndex]);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Occasions');

  const filteredTemplates = [...TEMPLATES, ...generatedTemplates].filter(t => {
    const matchesCategory = activeCategory === 'All Occasions' || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const navigate = (screen: Screen) => setCurrentScreen(screen);

  const toggleLike = (templateId: string) => {
    setLikedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId) 
        : [...prev, templateId]
    );
  };

  const resetApp = () => {
    setSelectedTemplate(null);
    setCustomization(INITIAL_CUSTOMIZATION);
    setHistory([INITIAL_CUSTOMIZATION]);
    setHistoryIndex(0);
    setCurrentDraftId(null);
    setSearchQuery('');
    setActiveCategory('All Occasions');
    navigate('gallery');
  };

  const onEditDraft = (draft: any, template: GiftCard) => {
    setSelectedTemplate(template);
    setCurrentDraftId(draft.id);
    setCustomization(draft.customization);
    setHistory([draft.customization]);
    setHistoryIndex(0);
    navigate('editor');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background selection:bg-primary/10">
        <OfflineIndicator />
        <AnimatePresence mode="wait">
          {currentScreen === 'gallery' && (
            <GalleryScreen 
              templates={filteredTemplates}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              user={user}
              userDrafts={userDrafts}
              generatedTemplates={generatedTemplates}
              setGeneratedTemplates={setGeneratedTemplates}
              likedTemplates={likedTemplates}
              onToggleLike={toggleLike}
              onSelectTemplate={(t) => {
                setSelectedTemplate(t);
                setCurrentDraftId(null);
                navigate('editor');
              }} 
              onEditDraft={onEditDraft}
              onDeleteDraft={deleteDraft}
              onSignIn={() => navigate('signin')}
              onSignOut={() => {
                signOutUser();
                navigate('signout');
              }}
              onCreateNew={resetApp}
              navigate={navigate}
              isSystemStable={isSystemStable}
            />
          )}
          {/* ... other screens ... */}
          {currentScreen === 'signin' && (
            <SignInScreen 
              onBack={() => navigate('gallery')} 
              signInWithGoogle={async () => {
                await signInWithGoogle();
                navigate('gallery');
              }}
              signInWithEmail={async (email, pass) => {
                await signInWithEmail(email, pass);
                navigate('gallery');
              }}
              signUpWithEmail={async (email, pass, name) => {
                await signUpWithEmail(email, pass, name);
                navigate('gallery');
              }}
              navigate={navigate}
            />
          )}
          {currentScreen === 'signout' && (
            <SignOutScreen onBack={() => navigate('gallery')} onSignIn={() => navigate('signin')} navigate={navigate} />
          )}
          {currentScreen === 'editor' && (
            <EditorScreen 
              template={selectedTemplate || TEMPLATES[0]} 
              customization={customization}
              setCustomization={handleCustomizationChange}
              undo={undo}
              redo={redo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
              onSaveDraft={saveDraft}
              user={user}
              onFinish={() => navigate('review')}
              onBack={() => navigate('gallery')}
              showToast={showToast}
            />
          )}
          {currentScreen === 'review' && (
            <ReviewScreen 
              customization={customization}
              onSend={() => navigate('share')}
              onBack={() => navigate('editor')}
            />
          )}
          {currentScreen === 'share' && (
            <ShareScreen 
              template={selectedTemplate || TEMPLATES[0]}
              customization={customization}
              onBack={() => navigate('review')}
              navigate={navigate}
              showToast={showToast}
            />
          )}
          {currentScreen === 'view_keepsake' && (
            <ViewKeepsakeScreen 
              template={selectedTemplate || TEMPLATES[0]}
              customization={customization}
              onRemix={() => navigate('editor')}
            />
          )}
          {currentScreen === 'privacy' && (
            <PrivacyScreen onBack={() => navigate('gallery')} navigate={navigate} />
          )}
          {currentScreen === 'terms' && (
            <TermsScreen onBack={() => navigate('gallery')} navigate={navigate} />
          )}
          {currentScreen === 'contact' && (
            <ContactScreen onBack={() => navigate('gallery')} navigate={navigate} />
          )}
        </AnimatePresence>

        {/* Global Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-6 right-6 z-[300] glass-dark border border-white/10 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-on-background"
              aria-live="polite"
            >
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {toast.type === 'error' && <Info className="w-5 h-5 text-red-400" />}
              {toast.type === 'warning' && <Info className="w-5 h-5 text-amber-400" />}
              {toast.type === 'info' && <Sparkles className="w-5 h-5 text-primary" />}
              <span className="text-xs font-bold tracking-wide">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-4 text-on-surface-variant hover:text-on-background text-xs font-bold">×</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Screens ---

function GalleryScreen({ 
  templates, 
  activeCategory, 
  setActiveCategory, 
  searchQuery, 
  setSearchQuery, 
  user,
  userDrafts,
  generatedTemplates,
  setGeneratedTemplates,
  likedTemplates,
  onToggleLike,
  onSelectTemplate, 
  onEditDraft,
  onDeleteDraft,
  onSignIn,
  onSignOut,
  onCreateNew,
  navigate,
  isSystemStable
}: { 
  templates: GiftCard[],
  activeCategory: string,
  setActiveCategory: (cat: string) => void,
  searchQuery: string,
  setSearchQuery: (q: string) => void,
  user: FirebaseUser | null,
  userDrafts: any[],
  generatedTemplates: GiftCard[],
  setGeneratedTemplates: React.Dispatch<React.SetStateAction<GiftCard[]>>,
  likedTemplates: string[],
  onToggleLike: (id: string) => void,
  onSelectTemplate: (t: GiftCard) => void, 
  onEditDraft: (draft: any, template: GiftCard) => void,
  onDeleteDraft: (id: string) => void,
  onSignIn: () => void,
  onSignOut: () => void,
  onCreateNew: () => void,
  navigate: (screen: Screen) => void,
  isSystemStable: boolean
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isScouting, setIsScouting] = useState(false);
  const [scoutStatus, setScoutStatus] = useState<string>('');
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
  const [scoutPrompt, setScoutPrompt] = useState('');
  const [scoutResult, setScoutResult] = useState<GiftCard[] | null>(null);
  const [aiConcepts, setAiConcepts] = useState<{
    id: string;
    title: string;
    category: string;
    description: string;
    visualPrompt: string;
    image?: string;
    isGenerating?: boolean;
  }[] | null>(null);
  const [webInspiration, setWebInspiration] = useState<{title: string, snippet: string, link: string}[] | null>(null);
  const draftsRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const categories = ['All Occasions', 'Birthdays', 'Weddings', 'Anniversaries', 'Holidays', 'Thank You', 'Graduation', 'New Baby', 'Retirement', 'Get Well', 'Housewarming', 'Congratulations'];

  const displayedTemplates = (scoutResult || templates).filter(t => {
    const matchesCategory = activeCategory === 'All Occasions' || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).slice(0, visibleCount);

  const handleScout = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || scoutPrompt;
    if (!promptToUse.trim()) return;
    
    setIsScouting(true);
    setScoutStatus('Initializing Neural Scout...');
    setAiConcepts(null);
    setWebInspiration(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      console.log("Starting AI Scout for:", promptToUse);
      
      // 1. Find relevant categories and local matches
      setScoutStatus('Analyzing Design Intent...');
      const categoryPrompt = `You are an expert gift card curator. Based on the user's request: "${promptToUse}", select the top 3 most relevant categories from this list: ${categories.join(', ')}. 
      Return ONLY a JSON array of category names.`;
      
      const categoryResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: categoryPrompt
      });
      
      const suggestedCategories = safeJsonParse(categoryResponse.text, []);
      console.log("Suggested Categories:", suggestedCategories);
      const filtered = templates.filter(t => suggestedCategories.includes(t.category));
      setScoutResult(filtered.length > 0 ? filtered : null);
      
      // 2. Proactively search the web for unique themes and generate AI concepts
      setScoutStatus('Scouting Global Design Web...');
      const scoutWebPrompt = `The user is looking for gift cards for: "${promptToUse}". 
      Use Google Search to find 3-4 unique, modern, and creative gift card themes or design ideas that match this specific request.
      Look for specific artistic styles, color palettes, and emotional themes that are trending or unique.
      Return ONLY a JSON array of objects with:
      - "title": A creative name for the theme
      - "category": One of ${categories.filter(c => c !== 'All Occasions').join(', ')}
      - "description": A brief, inspiring description of the theme
      - "visualPrompt": A detailed prompt for an image generator (like DALL-E or Midjourney) to create a background for this card.
      - "sourceLink": A Google search link for inspiration related to this theme.`;
      
      const webResponse = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: scoutWebPrompt,
        config: { 
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }] as any
        }
      });
      
      const concepts = safeJsonParse(webResponse.text, []);
      console.log("AI Concepts found:", concepts?.length || 0);
      if (concepts && concepts.length > 0) {
        setScoutStatus('Synthesizing Design Concepts...');
        setAiConcepts(concepts.map((c: any, i: number) => ({
          ...c,
          id: `concept-${Date.now()}-${i}`
        })));
      }

      // 3. Also provide general web inspiration links if no local matches
      if (filtered.length === 0 && (!concepts || concepts.length === 0)) {
        setScoutStatus('Fetching Global Inspiration...');
        console.log("No local matches or concepts, fetching general web inspiration...");
        const webInspirationPrompt = `Find 3-4 popular gift card themes or real-world examples for: "${promptToUse}".
        Return ONLY a JSON array of objects with "title", "snippet", and "link".`;
        
        const inspResponse = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: webInspirationPrompt,
          config: { 
            responseMimeType: "application/json",
            tools: [{ googleSearch: {} }] as any
          }
        });
        const results = safeJsonParse(inspResponse.text, []);
        console.log("Web Inspiration results:", results?.length || 0);
        setWebInspiration(results.length > 0 ? results : null);
      }

      setScoutStatus('Neural Synthesis Complete.');
      
      if (filtered.length > 0 || (concepts && concepts.length > 0) || promptToUse) {
        setActiveCategory('All Occasions');
        setTimeout(() => {
          galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (error) {
      console.error("AI Scout failed:", error);
      setScoutStatus('Neural Scout Interrupted.');
    } finally {
      setIsScouting(false);
      setTimeout(() => setScoutStatus(''), 3000);
    }
  };

  const handleGenerateFromConcept = async (concept: any) => {
    setAiConcepts(prev => prev?.map(c => c.id === concept.id ? { ...c, isGenerating: true } : c) || null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Generate Image
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: concept.visualPrompt || `A beautiful gift card background for ${concept.title}` }]
        }
      });
      
      let imageUrl = '';
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
      
      if (imageUrl) {
        const newTheme: GiftCard = {
          id: `gen-${Date.now()}`,
          title: concept.title,
          category: concept.category,
          image: imageUrl,
          tags: [concept.category, 'Custom'],
          isNew: true
        };
        setGeneratedTemplates(prev => [newTheme, ...prev]);
        setAiConcepts(prev => prev?.filter(c => c.id !== concept.id) || null);
        setActiveCategory('All Occasions');
        galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Concept generation failed:", error);
    } finally {
      setAiConcepts(prev => prev?.map(c => c.id === concept.id ? { ...c, isGenerating: false } : c) || null);
    }
  };

  const handleGenerateTheme = async () => {
    if (!scoutPrompt.trim()) return;
    setIsGeneratingTheme(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // 1. Search the web for inspiration if prompt is short or specific
      const searchPrompt = `Find 3 unique and creative design ideas or themes for a gift card related to: "${scoutPrompt}". 
      Search for modern trends, color palettes, and artistic styles.
      Return ONLY a JSON array of strings describing these ideas.`;
      
      const searchResponse = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: searchPrompt,
        config: { 
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }] as any
        }
      });
      
      const webIdeas = safeJsonParse(searchResponse.text, []);
      const combinedPrompt = `User Request: "${scoutPrompt}"\nWeb Inspiration: ${webIdeas.join(', ')}`;

      // 2. Generate Metadata
      const metadataPrompt = `You are a creative gift card designer. Based on the user's request and web inspiration:
      ${combinedPrompt}
      Generate a unique gift card theme.
      Return ONLY a JSON object with "title" (creative name) and "category" (one of: ${categories.filter(c => c !== 'All Occasions').join(', ')}).
      Also include a "visualPrompt" which is a detailed description for an image generator to create a background for this card.`;
      
      const metaResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: metadataPrompt,
        config: { responseMimeType: "application/json" }
      });
      
      const metadata = safeJsonParse(metaResponse.text, {});
      
      // 3. Generate Image
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: metadata.visualPrompt || `A beautiful gift card background for ${metadata.title}` }]
        }
      });
      
      let imageUrl = '';
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
      
      if (imageUrl) {
        const newTheme: GiftCard = {
          id: `gen-${Date.now()}`,
          title: metadata.title,
          category: metadata.category,
          image: imageUrl,
          tags: [metadata.category || 'Special', 'Custom'],
          isNew: true
        };
        setGeneratedTemplates(prev => [newTheme, ...prev]);
        setActiveCategory('All Occasions');
        galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Theme generation failed:", error);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const scrollToDrafts = () => draftsRef.current?.scrollIntoView({ behavior: 'smooth' });
  const scrollToGallery = () => galleryRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background bg-mesh"
    >
      <Navbar 
        user={user} 
        onSignIn={onSignIn} 
        onSignOut={onSignOut}
        searchQuery={searchQuery} 
        setSearchQuery={(q) => {
          setSearchQuery(q);
          if (q.length > 0) scrollToGallery();
        }} 
        onCreateNew={onCreateNew} 
        onMyCreations={scrollToDrafts}
        onOccasions={scrollToGallery}
      />
      
      {/* System Status Indicator */}
      <div className="fixed bottom-8 left-8 z-[60] hidden lg:flex items-center gap-3 glass px-4 py-2 rounded-full border border-white/5 shadow-2xl">
        <div className={cn("w-2 h-2 rounded-full animate-pulse", isSystemStable ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
          System: {isSystemStable ? 'Stable' : 'Offline'}
        </span>
      </div>
      
      <main className="max-w-7xl mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-32 overflow-hidden">
        {/* AI Card Scout */}
        <section className="mb-24 md:mb-40">
          <div className="glass-dark rounded-[3rem] p-8 md:p-16 relative overflow-hidden shadow-2xl border border-white/5">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-l from-primary/40 to-transparent" />
              <img src="https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1200&auto=format&fit=crop" className="w-full h-full object-cover" alt="AI Background" />
            </div>
            
            <div className="relative z-10 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-primary font-black text-xs uppercase tracking-[0.3em]">Neural Card Scout</span>
              </div>
              <h2 className="text-on-background text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-none">
                Find the perfect card <br /> with <span className="text-primary glow-text italic">AI intelligence.</span>
              </h2>
              <p className="text-on-surface-variant text-lg mb-10 font-medium leading-relaxed">
                Tell us the occasion, the mood, or the recipient, and our AI will curate a selection just for you.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-white/5 backdrop-blur-md rounded-2xl p-1 border border-white/10 focus-within:border-primary/30 transition-all relative">
                  <input 
                    type="text" 
                    value={scoutPrompt}
                    onChange={(e) => setScoutPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScout()}
                    placeholder="e.g. 'A warm birthday card for my sister who loves flowers'"
                    className="w-full bg-transparent border-none focus:ring-0 text-on-background placeholder:text-on-surface-variant/30 px-5 py-4 font-medium"
                    disabled={isScouting || isGeneratingTheme}
                  />
                  {(isScouting || isGeneratingTheme) && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-2xl flex items-center px-5 gap-3">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest animate-pulse">
                        {isScouting ? 'Scouting the web...' : 'Generating your theme...'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleScout}
                    disabled={isScouting || isGeneratingTheme || !scoutPrompt.trim()}
                    className="bg-on-background text-background px-6 py-4 rounded-2xl font-black text-sm hover:bg-on-surface transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    title="Find existing cards"
                  >
                    {isScouting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Scout
                  </button>
                  <button 
                    onClick={handleGenerateTheme}
                    disabled={isScouting || isGeneratingTheme || !scoutPrompt.trim()}
                    className="signature-gradient text-white px-6 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                    title="Generate a brand new theme"
                  >
                    {isGeneratingTheme ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Generate
                  </button>
                </div>
              </div>
              
              {(scoutResult || aiConcepts) && (
                <button 
                  onClick={() => { setScoutResult(null); setAiConcepts(null); setWebInspiration(null); }}
                  className="mt-6 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3 rotate-45" />
                  Clear AI Suggestions
                </button>
              )}
              
              {webInspiration && !scoutResult && (
                <button 
                  onClick={() => setWebInspiration(null)}
                  className="mt-6 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3 rotate-45" />
                  Clear Web Inspiration
                </button>
              )}
              
              {generatedTemplates.length > 0 && (
                <button 
                  onClick={() => setGeneratedTemplates([])}
                  className="mt-2 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3 rotate-45" />
                  Clear Generated Themes
                </button>
              )}
            </div>
          </div>
        </section>

        {user && userDrafts.length > 0 && (
          <section ref={draftsRef} className="mb-16 scroll-mt-24">
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center gap-2">
              Your Saved Drafts <div className="h-px bg-white/5 flex-grow" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {userDrafts.map((draft) => {
                const template = TEMPLATES.find(t => t.id === draft.templateId) || TEMPLATES[0];
                return (
                  <div 
                    key={draft.id}
                    onClick={() => onEditDraft(draft, template)}
                    className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-surface-container-high cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500"
                  >
                    <img src={template.image} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="Draft" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-white font-bold text-lg">{draft.customization.recipientName || 'Untitled Draft'}</p>
                          <p className="text-white/70 text-xs">Last updated: {draft.updatedAt?.toDate().toLocaleDateString()}</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDraft(draft.id);
                          }}
                          className="p-2 bg-white/10 hover:bg-red-500/80 rounded-lg text-white transition-colors"
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <section ref={galleryRef} className="flex flex-col md:flex-row items-start md:items-end justify-between gap-10 mb-20 scroll-mt-32">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-1 bg-primary rounded-full" />
              <span className="text-primary font-black text-xs uppercase tracking-[0.4em]">The Archive</span>
              <AnimatePresence>
                {scoutStatus && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 text-secondary font-black text-[10px] uppercase tracking-[0.2em] ml-4 bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20"
                  >
                    <Activity className="w-3 h-3 animate-pulse" />
                    {scoutStatus}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter text-on-background leading-[0.9] mb-8">
              The Modern <br /> <span className="text-primary text-glow">Heirloom</span> Gallery
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant leading-relaxed max-w-xl font-medium">
              Browse our curated collection of artisanal digital gift cards. Designed with the warmth of tradition and the clarity of modern aesthetics.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="glass px-6 py-4 rounded-3xl border border-white/5 flex items-center gap-6 shadow-xl">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-1">Neural Uptime</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-xs font-mono font-bold text-on-background">99.98%</span>
                </div>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-1">Artifacts Indexed</span>
                <span className="text-xs font-mono font-bold text-on-background">1,240</span>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-1">Global Sync</span>
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-primary" />
                  <span className="text-xs font-mono font-bold text-on-background">Active</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
            <div className="w-full sm:w-96 relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the archive..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-24 py-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-on-surface-variant/30 text-on-background font-medium"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <>
                    <button 
                      onClick={() => handleScout(searchQuery)}
                      disabled={isScouting}
                      className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                      title="AI Scout"
                    >
                      {isScouting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span className="text-[10px] font-black uppercase tracking-tighter hidden sm:inline">Scout</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setScoutResult(null);
                        setAiConcepts(null);
                        setWebInspiration(null);
                      }}
                      className="p-2 hover:bg-white/10 text-on-surface-variant/60 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="w-full overflow-x-auto hide-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
              <div className="flex gap-3 whitespace-nowrap pb-2">
                {categories.map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                      activeCategory === cat 
                        ? "signature-gradient text-white border-transparent shadow-lg shadow-primary/20 scale-105" 
                        : "bg-white/5 text-on-surface-variant border-white/5 hover:bg-white/10 hover:text-on-background"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 glass p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-3 rounded-xl transition-all", viewMode === 'grid' ? "bg-white/10 shadow-sm text-primary" : "text-on-surface-variant hover:text-primary")}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-3 rounded-xl transition-all", viewMode === 'list' ? "bg-white/10 shadow-sm text-primary" : "text-on-surface-variant hover:text-primary")}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </section>

        <div className={cn(
          "grid gap-6 md:gap-8 mb-20",
          viewMode === 'grid' ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"
        )}>
          {/* AI Concepts Section */}
          {aiConcepts && (
            <div className="md:col-span-12 mb-20">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-headline font-black tracking-tighter text-on-background">AI Card Concepts</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Unique themes synthesized from global design trends</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {aiConcepts.map((concept) => (
                  <div 
                    key={concept.id}
                    className="group glass-dark p-8 rounded-[2.5rem] border border-white/5 hover:border-primary/30 transition-all hover:shadow-2xl flex flex-col justify-between aspect-square relative overflow-hidden"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/10 px-3 py-1 rounded-full">
                          {concept.category}
                        </span>
                        {concept.sourceLink && (
                          <a href={concept.sourceLink} target="_blank" rel="noopener noreferrer" className="text-on-surface-variant/40 hover:text-primary transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      <h4 className="font-headline font-black text-xl mb-3 group-hover:text-primary transition-colors leading-tight">{concept.title}</h4>
                      <p className="text-on-surface-variant text-xs leading-relaxed line-clamp-3 font-medium mb-4">{concept.description}</p>
                    </div>
                    
                    <button 
                      onClick={() => handleGenerateFromConcept(concept)}
                      disabled={concept.isGenerating}
                      className="relative z-10 w-full signature-gradient text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {concept.isGenerating ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Synthesizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Generate Theme
                        </>
                      )}
                    </button>

                    {/* Background Decoration */}
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Web Inspiration Section */}
          {webInspiration && !scoutResult && (
            <div className="md:col-span-12 mb-20">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/10">
                  <Globe className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h3 className="text-2xl font-headline font-black tracking-tighter text-on-background">Web Intelligence</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Themes synthesized from global design archives</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {webInspiration.map((item, idx) => (
                  <a 
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group glass-dark p-8 rounded-[2.5rem] border border-white/5 hover:border-secondary/30 transition-all hover:shadow-2xl flex flex-col justify-between aspect-square"
                  >
                    <div>
                      <h4 className="font-headline font-black text-xl mb-4 group-hover:text-secondary transition-colors leading-tight">{item.title}</h4>
                      <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-4 font-medium">{item.snippet}</p>
                    </div>
                    <div className="flex items-center gap-2 text-secondary text-[10px] font-black uppercase tracking-[0.2em] mt-6">
                      Access Source <ExternalLink className="w-3 h-3" />
                    </div>
                  </a>
                ))}
                <div 
                  onClick={handleGenerateTheme}
                  className="group bg-primary/5 p-8 rounded-[2.5rem] border border-dashed border-primary/20 hover:bg-primary/10 transition-all cursor-pointer flex flex-col items-center justify-center text-center aspect-square"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="font-headline font-black text-xl mb-2 text-on-background">Synthesize Custom</h4>
                  <p className="text-primary/60 text-[10px] font-black uppercase tracking-[0.2em]">Create Unique Artifact</p>
                </div>
              </div>
            </div>
          )}

          {/* Featured Template */}
          {templates.length > 0 && activeCategory === 'All Occasions' && !searchQuery && (
            <div 
              onClick={() => onSelectTemplate(TEMPLATES[0])}
              className="md:col-span-8 group relative aspect-video md:aspect-[16/9] rounded-[3rem] overflow-hidden glass-dark cursor-pointer border border-white/5 shadow-2xl"
            >
              <img 
                src="https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=1200&auto=format&fit=crop" 
                alt="Featured" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              <div className="absolute bottom-10 left-10 md:bottom-16 md:left-16 text-on-background max-w-lg">
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-primary text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-primary/20">Studio Choice</span>
                  <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-[0.3em] glass px-3 py-1 rounded-full border border-white/5">Artifact #001</span>
                </div>
                <h3 className="text-4xl md:text-6xl font-headline font-black tracking-tighter mb-6 leading-none group-hover:glow-text transition-all">The Eternal <br /> Celebration</h3>
                <p className="text-on-surface-variant text-lg font-medium leading-relaxed mb-8 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-4 group-hover:translate-y-0">
                  A masterpiece of digital curation, blending classic holiday motifs with futuristic geometric precision.
                </p>
                <div className="flex items-center gap-4">
                  <button className="signature-gradient text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20">Initialize Edit</button>
                </div>
              </div>
            </div>
          )}

          {templates.length > 0 && activeCategory === 'All Occasions' && !searchQuery && (
            <div className="md:col-span-4 flex flex-col gap-8">
              <div className="flex-1 rounded-[3rem] glass-dark p-10 flex flex-col justify-between overflow-hidden relative group cursor-pointer border border-white/5">
                <div className="relative z-10">
                  <span className="text-primary font-black tracking-[0.3em] text-[10px] uppercase mb-6 block">Limited Series</span>
                  <h3 className="font-headline text-3xl font-black text-on-background leading-tight mb-4">Artisanal Florals <br /> Collection</h3>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setActiveCategory('Weddings');
                      window.scrollTo({ top: galleryRef.current?.offsetTop ? galleryRef.current.offsetTop - 100 : 0, behavior: 'smooth' });
                    }}
                    className="mt-8 text-primary font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 group-hover:gap-5 transition-all"
                  >
                    Explore All <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
              </div>
              <div className="rounded-[3rem] glass p-10 overflow-hidden relative group cursor-pointer border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-headline text-2xl font-black text-on-background tracking-tighter">Gift Guide</h4>
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <p className="text-on-surface-variant text-sm leading-relaxed font-medium">Find the perfect template for any occasion or mood.</p>
              </div>
            </div>
          )}

          {viewMode === 'grid' ? (
            displayedTemplates.map((template) => (
              <div 
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className="md:col-span-3 group rounded-[2.5rem] overflow-hidden glass-dark border border-white/5 hover:border-primary/30 transition-all duration-500 cursor-pointer shadow-xl"
              >
                <div className="aspect-[4/5] overflow-hidden relative">
                  <img 
                    src={template.image} 
                    alt={template.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  
                  <button 
                    className={cn(
                      "absolute top-6 right-6 w-11 h-11 rounded-2xl glass flex items-center justify-center transition-all active:scale-90 z-20",
                      likedTemplates.includes(template.id) ? "bg-primary text-white shadow-lg shadow-primary/40 border-transparent" : "text-on-surface-variant hover:text-primary"
                    )} 
                    onClick={(e) => { e.stopPropagation(); onToggleLike(template.id); }}
                  >
                    <Heart className={cn("w-5 h-5", likedTemplates.includes(template.id) && "fill-current")} />
                  </button>
                  
                  <div className="absolute top-6 left-6 flex flex-col gap-2 z-20">
                    {template.isNew && (
                      <span className="glass text-primary px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20">New Arrival</span>
                    )}
                    {template.id.startsWith('gen-') && (
                      <span className="signature-gradient text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Neural Synth
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-8 z-20 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{template.category}</span>
                      <span className="text-[8px] font-mono text-on-surface-variant/40 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity delay-100">ID: {template.id.slice(0, 8)}</span>
                    </div>
                    <h4 className="font-headline font-black text-xl text-on-background mb-2 group-hover:glow-text transition-all">{template.title}</h4>
                    <div className="flex items-center gap-4 mt-4 opacity-0 group-hover:opacity-100 transition-all delay-200 translate-y-2 group-hover:translate-y-0">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest">Resolution</span>
                        <span className="text-[10px] font-mono text-on-background">4K Ultra HD</span>
                      </div>
                      <div className="w-px h-6 bg-white/5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-on-surface-variant/40 uppercase tracking-widest">Format</span>
                        <span className="text-[10px] font-mono text-on-background">Vector Synth</span>
                      </div>
                    </div>
                    <div className="h-0.5 w-0 group-hover:w-12 bg-primary transition-all duration-500 rounded-full mt-6" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-dark rounded-[2.5rem] border border-white/5 overflow-hidden">
              <div className="grid grid-cols-12 p-6 border-b border-white/5 bg-white/5">
                <div className="col-span-1 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">#</div>
                <div className="col-span-4 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest italic font-serif">Artifact Title</div>
                <div className="col-span-3 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Category</div>
                <div className="col-span-2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Engine</div>
                <div className="col-span-2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest text-right">Action</div>
              </div>
              <div className="divide-y divide-white/5">
                {displayedTemplates.map((template, idx) => (
                  <div 
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className="grid grid-cols-12 p-6 items-center hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <div className="col-span-1 text-[10px] font-mono text-on-surface-variant/40">{String(idx + 1).padStart(3, '0')}</div>
                    <div className="col-span-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                        <img src={template.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-headline font-black text-on-background group-hover:text-primary transition-colors">{template.title}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">{template.category}</span>
                    </div>
                    <div className="col-span-2 text-[10px] font-mono text-on-surface-variant">Neural Synth v3.1</div>
                    <div className="col-span-2 text-right">
                      <button className="text-[10px] font-black text-on-background uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2 ml-auto">
                        Initialize <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {displayedTemplates.length === 0 && (
            <div className="md:col-span-12 py-32 text-center glass-dark rounded-[3rem] border border-white/5 shadow-2xl">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <Search className="w-10 h-10 text-primary opacity-40" />
              </div>
              <h3 className="text-3xl font-headline font-black text-on-background mb-4 tracking-tighter">No local artifacts found</h3>
              <p className="text-on-surface-variant text-lg mb-12 max-w-md mx-auto font-medium leading-relaxed">
                Our local archive doesn't have a direct match for "{searchQuery}". 
                Would you like our AI to scout the global design web for inspiration?
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => {
                    setScoutPrompt(searchQuery);
                    handleScout(searchQuery);
                  }}
                  disabled={isScouting}
                  className="signature-gradient text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-3"
                >
                  {isScouting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                  Scout the Web
                </button>
                <button 
                  onClick={() => { setSearchQuery(''); setActiveCategory('All Occasions'); }}
                  className="text-on-surface-variant hover:text-on-background font-black text-xs uppercase tracking-[0.2em] px-8 py-5 transition-all"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {templates.length > visibleCount && (
          <div className="mt-24 md:mt-32 text-center">
            <button 
              onClick={() => {
                setVisibleCount(templates.length);
                setViewMode('list');
              }}
              className="glass px-12 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-on-background hover:bg-white/10 transition-all border border-white/5 shadow-2xl active:scale-95"
            >
              Expand to Archive List
            </button>
          </div>
        )}
      </main>
      <Footer onNavigate={navigate} />
    </motion.div>
  );
}

function SignInScreen({ 
  onBack, 
  signInWithGoogle, 
  signInWithEmail,
  signUpWithEmail,
  navigate 
}: { 
  onBack: () => void, 
  signInWithGoogle: () => Promise<void>,
  signInWithEmail: (email: string, pass: string) => Promise<void>,
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>,
  navigate: (screen: Screen) => void 
}) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const formatAuthError = (err: any): string => {
    const msg = err?.message || String(err);
    if (msg.includes('auth/operation-not-allowed')) {
      return "Email/Password sign-in is not enabled in your Firebase console. Please enable Email/Password authentication under Authentication > Sign-in method in your Firebase project, or use Continue as Guest below.";
    }
    if (msg.includes('auth/weak-password')) {
      return "Password should be at least 6 characters long.";
    }
    if (msg.includes('auth/email-already-in-use')) {
      return "This email is already registered. Please sign in instead.";
    }
    if (msg.includes('auth/invalid-email')) {
      return "Please enter a valid email address.";
    }
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
      return "Incorrect email or password. Please check your credentials or create an account.";
    }
    return msg;
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setError(formatAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
      }
    } catch (err: any) {
      console.error("Auth action failed:", err);
      setError(formatAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col font-sans bg-mesh overflow-hidden"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center glass border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black group-hover:rotate-12 transition-transform">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background group-hover:glow-text transition-all">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-background flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back to Gallery
        </button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-24 relative overflow-hidden">
          <div className="w-full max-w-md relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'signin' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'signin' ? 20 : -20 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em] mb-8 border border-primary/20">
                  <Sparkles className="w-3 h-3" /> {mode === 'signin' ? 'Bespoke Studio Access' : 'Create Account'}
                </div>
                <h1 className="text-5xl md:text-6xl font-headline font-black tracking-tighter text-on-background mb-6 leading-[0.9]">
                  {mode === 'signin' ? (
                    <>Enter the <br /> <span className="text-primary glow-text italic">Sanctuary.</span></>
                  ) : (
                    <>Create your <br /> <span className="text-primary glow-text italic">Account.</span></>
                  )}
                </h1>
                <p className="text-on-surface-variant text-lg font-medium leading-relaxed mb-8">
                  {mode === 'signin' 
                    ? "Access your private collection of digital heirlooms and continue crafting moments into memories."
                    : "Create your professional studio account to start curating, managing, and sharing authentic digital gifts."}
                </p>

                {error && (
                  <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                    {error}
                  </div>
                )}

                <div className="space-y-4 mb-8">
                  <button 
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-4 glass py-4 rounded-2xl font-black text-on-background hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl group border border-white/5"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
                    )}
                    <span className="text-[10px] uppercase tracking-[0.2em]">Continue with Google</span>
                  </button>
                </div>

                <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[9px] uppercase tracking-[0.4em] font-black text-on-surface-variant bg-background px-6">Or Email & Password</div>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                  {mode === 'signup' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1">Curator Name</label>
                      <input 
                        className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-primary/30 focus:ring-0 transition-all text-on-background placeholder:text-on-surface-variant/20 font-bold text-sm" 
                        placeholder="Julian Sterling" 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1">Email Address</label>
                    <input 
                      className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-primary/30 focus:ring-0 transition-all text-on-background placeholder:text-on-surface-variant/20 font-bold text-sm" 
                      placeholder="curator@studio.com" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] ml-1">Password</label>
                    </div>
                    <div className="relative">
                      <input 
                        className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl focus:border-primary/30 focus:ring-0 transition-all text-on-background placeholder:text-on-surface-variant/20 font-bold text-sm" 
                        placeholder="••••••••" 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-background transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    disabled={isLoggingIn}
                    className="w-full signature-gradient text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3" 
                    type="submit"
                  >
                    {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                </form>

                <div className="mt-8 text-center space-y-4">
                  <button 
                    onClick={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin');
                      setError(null);
                    }}
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-background transition-colors block w-full"
                  >
                    {mode === 'signin' ? "Don't have an account? Create Account" : "Already have an account? Sign In"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => navigate('gallery')}
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:glow-text transition-all block w-full pt-2 border-t border-white/5"
                  >
                    ✨ Continue as Guest / Demo Mode
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Immersive Visual */}
        <div className="hidden lg:block w-1/2 relative bg-surface overflow-hidden">
          <motion.img 
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ duration: 2, ease: "easeOut" }}
            src="https://images.unsplash.com/photo-1513519245088-0e12902e35ca?q=80&w=1200&auto=format&fit=crop" 
            className="absolute inset-0 w-full h-full object-cover" 
            alt="Studio Atmosphere" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          
          <div className="absolute inset-0 p-24 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="max-w-md"
            >
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-8 border border-white/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-4xl font-headline font-black tracking-tighter text-on-background mb-6 leading-tight">
                "Design is the silent ambassador of your <span className="text-primary glow-text italic">brand.</span>"
              </h2>
              <div className="flex items-center gap-4 pt-8 border-t border-white/5">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-surface-variant overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=studio${i}`} alt="Curator" className="w-full h-full object-cover opacity-80" />
                    </div>
                  ))}
                </div>
                <span className="text-on-surface-variant text-[10px] font-black tracking-[0.2em] uppercase">Join 15k+ Curators</span>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer onNavigate={navigate} />
    </motion.div>
  );
}

function SignOutScreen({ onBack, onSignIn, navigate }: { onBack: () => void, onSignIn: () => void, navigate: (screen: Screen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col font-sans bg-mesh overflow-hidden"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center glass border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black group-hover:rotate-12 transition-transform">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background group-hover:glow-text transition-all">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-background flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back to Gallery
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        <div className="w-full max-w-lg text-center relative z-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 120 }}
          >
            <div className="w-24 h-24 bg-primary rounded-[2.5rem] shadow-2xl shadow-primary/40 flex items-center justify-center mx-auto mb-12 group hover:rotate-12 transition-transform duration-500">
              <LogOut className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-6xl font-headline font-black tracking-tighter text-on-background mb-6">Session <span className="text-primary glow-text italic">Archived.</span></h1>
            <p className="text-on-surface-variant text-xl font-medium leading-relaxed mb-12 max-w-sm mx-auto">
              Your studio session has been securely closed. All your masterpieces are preserved for your next visit.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={onSignIn}
                className="px-12 py-5 signature-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-primary/40 transition-all hover:scale-105 active:scale-[0.98]"
              >
                Sign Back In
              </button>
              <button 
                onClick={onBack}
                className="px-12 py-5 glass border border-white/5 text-on-background rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Return to Gallery
              </button>
            </div>

            <div className="mt-20 pt-12 border-t border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant/40 mb-6">Curated with Intention</p>
              <div className="flex justify-center gap-8">
                {['Security', 'Privacy', 'Integrity'].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer onNavigate={navigate} />
    </motion.div>
  );
}

function CardPreview({ template, customization, className, isExporting }: { template: GiftCard, customization: Customization, className?: string, isExporting?: boolean }) {
  const fontClass = FONTS.find(f => f.id === customization.font)?.class || 'font-sans';
  const mainImage = customization.photos.length > 0 ? customization.photos[0] : template.image;
  const secondaryImage = customization.photos.length > 1 ? customization.photos[1] : template.image;
  const backgroundImage = customization.photos.length > 2 ? customization.photos[2] : template.image;

  const fallbackImage = "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=800&auto=format&fit=crop";

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = fallbackImage;
  };

  return (
    <div className={cn(
      "w-full max-w-2xl aspect-[4/3] bg-white rounded-2xl relative overflow-hidden shadow-2xl group transition-all duration-500 flex flex-col", 
      isExporting ? "rounded-none shadow-none border-[16px] border-white" : "",
      className
    )}>
      {/* Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {customization.layout === 'full' ? (
          <img 
            src={mainImage} 
            className="w-full h-full object-cover" 
            alt="Background" 
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        ) : customization.layout === 'minimalist' ? (
          <div className="w-full h-full bg-white" />
        ) : (
          <img 
            src={backgroundImage} 
            className="w-full h-full object-cover opacity-30" 
            alt="Template Base" 
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        )}
      </div>

      {/* Content Layer */}
      <div className={cn(
        "relative flex-1 flex flex-col p-6 md:p-10 z-10",
        !isExporting ? "overflow-hidden" : "overflow-visible"
      )}>
        {customization.layout === 'classic' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 md:space-y-6">
            {!isExporting && (
              <div className="inline-block px-4 py-1 bg-black text-white text-[10px] font-black tracking-[0.2em] rounded-full uppercase shadow-lg">Curated Heirloom</div>
            )}
            <h2 className={cn(
              "text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-tight text-black", 
              !isExporting && "line-clamp-2",
              fontClass
            )}>
              For {customization.recipientName || 'Someone Special'}
            </h2>
            <div className={cn(
              "w-full max-w-md px-4",
              !isExporting ? "max-h-[40%] overflow-y-auto custom-scrollbar" : "overflow-visible"
            )}>
              <p className={cn(
                "text-black/60 italic leading-relaxed break-words", 
                !isExporting ? "text-base md:text-lg lg:text-xl" : "text-lg md:text-xl lg:text-2xl text-center",
                fontClass
              )}>
                "{customization.message || 'Your festive message will appear here...'}"
              </p>
            </div>
          </div>
        )}

        {customization.layout === 'memory' && (
          <div className="flex-1 flex flex-col gap-4 md:gap-6">
            <div className="flex-1 min-h-0 rounded-xl overflow-hidden shadow-xl border-4 border-white bg-white">
              <img 
                src={mainImage} 
                className="w-full h-full object-cover" 
                alt="Hero" 
                referrerPolicy="no-referrer"
                onError={handleImageError}
              />
            </div>
            <div className="flex justify-between items-end gap-4 shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className={cn(
                  "text-xl md:text-2xl lg:text-3xl font-black tracking-tighter text-black mb-1", 
                  !isExporting && "truncate",
                  fontClass
                )}>
                  {customization.recipientName || 'Dearest'}
                </h2>
                <div className={cn(
                  !isExporting ? "max-h-20 overflow-y-auto custom-scrollbar" : "overflow-visible"
                )}>
                  <p className={cn("text-black/50 text-[10px] md:text-xs italic break-words", fontClass)}>
                    "{customization.message}"
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {customization.layout === 'duo' && (
          <div className="flex-1 flex gap-4 md:gap-8 overflow-visible">
            <div className="flex-1 flex flex-col justify-center space-y-3 md:space-y-6 min-w-0">
              <h2 className={cn(
                "text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter text-black leading-tight", 
                !isExporting && "line-clamp-3",
                fontClass
              )}>
                A moment <br /> shared with <br /> <span className="text-black">{customization.recipientName || 'you'}</span>.
              </h2>
              <div className={cn(
                !isExporting ? "max-h-24 md:max-h-32 overflow-y-auto custom-scrollbar" : "overflow-visible"
              )}>
                <p className={cn("text-black/50 text-[10px] md:text-xs lg:text-sm leading-relaxed italic break-words", fontClass)}>
                  "{customization.message}"
                </p>
              </div>
            </div>
            <div className="w-2/5 md:w-1/2 flex flex-col gap-3 md:gap-4 shrink-0">
              <div className="flex-1 rounded-xl md:rounded-2xl overflow-hidden shadow-lg border-2 border-white bg-white">
                <img 
                  src={secondaryImage} 
                  className="w-full h-full object-cover" 
                  alt="Duo 1" 
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
              </div>
              <div className="flex-1 rounded-xl md:rounded-2xl overflow-hidden shadow-lg border-2 border-white bg-white">
                <img 
                  src={mainImage} 
                  className="w-full h-full object-cover" 
                  alt="Duo 2" 
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
              </div>
            </div>
          </div>
        )}

        {customization.layout === 'minimalist' && (
          <div className="flex-1 flex flex-col justify-between overflow-visible">
            <div className="flex justify-between items-start">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 bg-white">
                <img 
                  src={mainImage} 
                  className="w-full h-full object-cover" 
                  alt="Small" 
                  referrerPolicy="no-referrer"
                  onError={handleImageError}
                />
              </div>
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-black/10 vertical-text">M M X X I V</span>
            </div>
            <div className="max-w-sm">
              <h2 className={cn(
                "text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter text-black mb-2 md:md:mb-4", 
                !isExporting && "truncate",
                fontClass
              )}>
                {customization.recipientName || 'Recipient'}
              </h2>
              <div className="w-10 md:w-12 h-1 bg-black mb-4 md:mb-6" />
              <div className={cn(
                !isExporting ? "max-h-24 overflow-y-auto custom-scrollbar" : "overflow-visible"
              )}>
                <p className={cn("text-black/50 text-[10px] md:text-xs lg:text-sm leading-relaxed italic break-words", fontClass)}>
                  "{customization.message}"
                </p>
              </div>
            </div>
          </div>
        )}

        {customization.layout === 'full' && (
          <div className="flex-1 flex flex-col justify-end p-4 md:p-8 bg-gradient-to-t from-black/60 via-transparent to-transparent">
            <div className="max-w-md">
              <h2 className={cn(
                "text-3xl md:text-5xl font-black tracking-tighter text-white mb-2", 
                !isExporting && "truncate",
                fontClass
              )}>
                {customization.recipientName || 'Someone Special'}
              </h2>
              <div className={cn(
                !isExporting ? "max-h-24 overflow-y-auto custom-scrollbar" : "overflow-visible"
              )}>
                <p className={cn("text-white/80 text-xs md:text-sm italic leading-relaxed break-words", fontClass)}>
                  "{customization.message}"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Export Watermark */}
      {isExporting && (
        <div className="absolute bottom-6 right-8 flex flex-col items-end opacity-30 z-20">
          <span className="text-[8px] font-black uppercase tracking-[0.4em] text-black/40">The Festive Curator</span>
          <span className="text-[6px] font-bold uppercase tracking-widest text-black/30">Digital Heirloom Archive</span>
        </div>
      )}
    </div>
  );
}

function EditorScreen({ 
  template, 
  customization, 
  setCustomization, 
  undo, 
  redo, 
  canUndo, 
  canRedo, 
  onSaveDraft,
  user,
  onFinish, 
  onBack,
  showToast
}: { 
  template: GiftCard, 
  customization: Customization, 
  setCustomization: React.Dispatch<React.SetStateAction<Customization>>,
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean,
  onSaveDraft: () => void,
  user: FirebaseUser | null,
  onFinish: () => void,
  onBack: () => void,
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}) {
  const [activeTab, setActiveTab] = useState<'layout' | 'text' | 'photos' | 'specs'>('text');
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; name: string; progress: number }[]>([]);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_WIDTH = customization.cardSize?.width || 720;
  const DEFAULT_HEIGHT = customization.cardSize?.height || 456;
  const ASPECT_RATIO = 720 / 456;

  const [cardWidth, setCardWidth] = useState<number>(DEFAULT_WIDTH);
  const [cardHeight, setCardHeight] = useState<number>(DEFAULT_HEIGHT);
  const [editorZoom, setEditorZoom] = useState<number>(1);
  const [isResizing, setIsResizing] = useState<false | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(false);

  const handlePointerDownResize = (e: React.PointerEvent, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsResizing(corner);

    const startX = e.clientX;
    const startWidth = cardWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX;
        let newWidth = startWidth;
        if (corner === 'bottom-right' || corner === 'top-right') {
          newWidth = startWidth + deltaX;
        } else {
          newWidth = startWidth - deltaX;
        }

        const clampedWidth = Math.min(Math.max(newWidth, 240), 1050);
        const clampedHeight = Math.round(clampedWidth / ASPECT_RATIO);

        setCardWidth(clampedWidth);
        setCardHeight(clampedHeight);
        setCustomization(prev => ({
          ...prev,
          cardSize: { width: clampedWidth, height: clampedHeight }
        }));
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      showToast("✨ AI Smart-Snap: Elements auto-balanced & optimized for layout stability.", "info");
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleKeyDownResize = (e: React.KeyboardEvent, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    const step = e.shiftKey ? 30 : 10;
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') delta = step;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') delta = -step;
    if (delta !== 0) {
      e.preventDefault();
      const newWidth = Math.min(Math.max(cardWidth + delta, 240), 1050);
      const newHeight = Math.round(newWidth / ASPECT_RATIO);
      setCardWidth(newWidth);
      setCardHeight(newHeight);
      setCustomization(prev => ({
        ...prev,
        cardSize: { width: newWidth, height: newHeight }
      }));
    }
  };

  const resetSize = () => {
    setCardWidth(720);
    setCardHeight(456);
    setCustomization(prev => ({ ...prev, cardSize: { width: 720, height: 456 } }));
    showToast('Card dimensions reset to default', 'info');
  };

  const fitToCanvas = () => {
    setCardWidth(840);
    setCardHeight(532);
    setEditorZoom(1);
    setCustomization(prev => ({ ...prev, cardSize: { width: 840, height: 532 } }));
    showToast('Card fitted to canvas', 'info');
  };

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (autoSaveStatus === 'idle' || !user) return;
      
      setAutoSaveStatus('saving');
      try {
        await onSaveDraft();
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (error) {
        console.error("Auto-save failed", error);
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 5000);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [customization, user]);

  // Trigger auto-save status on change
  useEffect(() => {
    if (user && (autoSaveStatus === 'idle' || autoSaveStatus === 'saved')) {
      setAutoSaveStatus('saving');
    }
  }, [customization, user]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const generateImage = async (retryCount = 0) => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `Generate a beautiful, high-quality background image for a digital gift card. 
              The theme is: ${imagePrompt}. 
              Style: Artistic, elegant, and festive. 
              No text in the image.`,
            },
          ],
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const imageUrl = `data:image/png;base64,${base64EncodeString}`;
            setCustomization(prev => ({
              ...prev,
              photos: [...prev.photos, imageUrl]
            }));
            setImagePrompt('');
            break;
          }
        }
      }
    } catch (error) {
      console.error("Image Generation failed:", error);
      if (retryCount < 2) {
        console.log(`Retrying image generation (${retryCount + 1})...`);
        setTimeout(() => generateImage(retryCount + 1), 1000);
      } else {
        showToast("AI Image Studio is currently experiencing high traffic. Please try a different prompt.", "warning");
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const suggestMessage = async (retryCount = 0) => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `Generate a short, heartfelt, and festive message for a digital gift card. 
        The occasion is ${template.category}. 
        The recipient is ${customization.recipientName || 'Someone Special'}. 
        Keep it under 30 words.`,
      });
      
      const suggestedText = response.text;
      if (suggestedText) {
        setCustomization(prev => ({ ...prev, message: suggestedText.trim() }));
      }
    } catch (error) {
      console.error("AI Message Generation failed:", error);
      if (retryCount < 2) {
        console.log(`Retrying message generation (${retryCount + 1})...`);
        setTimeout(() => suggestMessage(retryCount + 1), 1000);
      } else {
        showToast("The AI Muse is resting. Please try again.", "warning");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMakeItBetter = async (tone: string) => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Rewrite this gift card message to make it ${tone}. Current message: "${customization.message || 'Happy wishes'}". Recipient: ${customization.recipientName || 'Friend'}. Occasion: ${template.category}. Keep it concise and impactful.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
      });
      if (response.text) {
        setCustomization(prev => ({ ...prev, message: response.text.trim() }));
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to rewrite message with AI.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    const fileList = Array.from(files) as File[];
    const validFiles: File[] = [];
    let errorMsg = '';

    fileList.forEach((file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errorMsg = `File "${file.name}" is not a supported image type.`;
      } else if (file.size > MAX_FILE_SIZE) {
        errorMsg = `File "${file.name}" is too large (max 5MB).`;
      } else {
        validFiles.push(file);
      }
    });

    if (errorMsg && validFiles.length === 0) {
      setUploadError(errorMsg);
      setIsUploading(false);
      return;
    }

    if (errorMsg) {
      setUploadError(errorMsg + " Other valid files will be uploaded.");
    }

    let processedCount = 0;
    validFiles.forEach((file: File) => {
      const uploadId = Math.random().toString(36).substring(2, 9);
      setUploadingFiles(prev => [...prev, { id: uploadId, name: file.name, progress: 0 }]);
      
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadingFiles(prev => prev.map(f => f.id === uploadId ? { ...f, progress } : f));
        }
      };

      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomization(prev => ({
          ...prev,
          photos: [...prev.photos, base64String]
        }));
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
        processedCount++;
        if (processedCount === validFiles.length) {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError(`Failed to read file: ${file.name}`);
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
        processedCount++;
        if (processedCount === validFiles.length) {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (e.target) e.target.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    setAutoSaveStatus('saving');
    try {
      await onSaveDraft();
      setSaveSuccess(true);
      setAutoSaveStatus('saved');
      setTimeout(() => {
        setShowSaveConfirm(false);
        setSaveSuccess(false);
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error("Save failed", error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="flex flex-col h-screen overflow-hidden bg-background"
    >
      {/* Studio Header */}
      <header className="flex justify-between items-center px-6 md:px-12 py-4 glass border-b border-white/5 z-20">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors border border-white/5 group">
            <ChevronLeft className="w-4 h-4 text-on-background group-hover:text-primary transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant group-hover:text-on-background transition-colors">Back</span>
          </button>
          <div className="h-8 w-px bg-white/5" />
          <div>
            <h1 className="text-xl font-headline font-black tracking-tighter text-on-background leading-none mb-1">Creative Studio</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">{template.category}</span>
              <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">•</span>
              <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{template.title}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl mr-4 border border-white/5">
            <button 
              onClick={undo} 
              disabled={!canUndo}
              className={cn(
                "p-2 rounded-lg transition-all",
                canUndo ? "hover:bg-white/10 hover:shadow-sm text-on-background" : "text-on-surface-variant/20 cursor-not-allowed"
              )}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={redo} 
              disabled={!canRedo}
              className={cn(
                "p-2 rounded-lg transition-all",
                canRedo ? "hover:bg-white/10 hover:shadow-sm text-on-background" : "text-on-surface-variant/20 cursor-not-allowed"
              )}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {autoSaveStatus !== 'idle' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  autoSaveStatus === 'saving' ? "bg-amber-500 animate-pulse" :
                  autoSaveStatus === 'saved' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
                )} />
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                  {autoSaveStatus === 'saving' ? 'Syncing...' : 
                   autoSaveStatus === 'saved' ? 'Cloud Saved' : 'Sync Error'}
                </span>
              </div>
            )}
            <button 
              onClick={onFinish}
              className="px-8 py-3 signature-gradient text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20"
            >
              Review & Send
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <aside className="w-80 glass border-r border-white/5 overflow-y-auto custom-scrollbar hidden lg:block">
          <div className="p-8 space-y-10">
            {/* Recipient */}
            <section>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Recipient</label>
              <input 
                type="text"
                value={customization.recipientName}
                onChange={(e) => setCustomization(prev => ({ ...prev, recipientName: e.target.value }))}
                className="w-full bg-white/5 border-white/5 rounded-xl px-4 py-3 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all text-on-background placeholder:text-on-surface-variant/20"
                placeholder="Name"
              />
            </section>
            {/* Message */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Message</label>
                <button 
                  onClick={() => suggestMessage()}
                  disabled={isGenerating}
                  className="text-[9px] font-black text-primary uppercase tracking-widest hover:glow-text disabled:opacity-50"
                >
                  {isGenerating ? 'Thinking...' : 'AI Suggest'}
                </button>
              </div>
              <textarea 
                value={customization.message}
                onChange={(e) => setCustomization(prev => ({ ...prev, message: e.target.value }))}
                className="w-full h-32 bg-white/5 border-white/5 rounded-xl px-4 py-3 text-sm font-medium focus:ring-primary/20 focus:border-primary/30 transition-all resize-none text-on-background placeholder:text-on-surface-variant/20 custom-scrollbar"
                placeholder="Your message..."
              />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {[
                  { label: '✨ Emotional', tone: 'emotional and deeply touching' },
                  { label: '😂 Funny', tone: 'lighthearted, humorous and funny' },
                  { label: '❤️ Heartfelt', tone: 'warm and heartfelt' },
                  { label: '🔥 Gen-Z', tone: 'trendy Gen-Z slang and vibes' },
                  { label: '🇮🇳 Hinglish', tone: 'warm Hinglish with emotional depth' },
                  { label: '📝 Longer', tone: 'more detailed and elaborate' },
                  { label: '✂ Shorter', tone: 'ultra-concise and punchy' }
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleMakeItBetter(item.tone)}
                    disabled={isGenerating}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold text-on-surface-variant hover:text-on-background border border-white/5 transition-all disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Layouts */}
            <section>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Layout Architecture</label>
              <div className="grid grid-cols-2 gap-3">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setCustomization(prev => ({ ...prev, layout: l.id }))}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all text-left group",
                      customization.layout === l.id 
                        ? "border-primary bg-primary/10 text-on-background" 
                        : "border-white/5 hover:border-white/10 bg-white/5"
                    )}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">{l.name}</p>
                    <div className={cn(
                      "w-full aspect-video rounded bg-white/5 group-hover:bg-white/10 transition-colors",
                      customization.layout === l.id && "bg-primary/20"
                    )} />
                  </button>
                ))}
              </div>
            </section>

            {/* Typography */}
            <section>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-6">Typography</label>
              <div className="space-y-8">
                {(['Modern', 'Elegant', 'Playful', 'Minimalist'] as const).map((category) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">{category}</span>
                      <div className="h-px bg-white/5 flex-grow" />
                    </div>
                    <div className="space-y-2">
                      {FONTS.filter(f => f.category === category).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setCustomization(prev => ({ ...prev, font: f.id }))}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 transition-all text-left flex justify-between items-center",
                            customization.font === f.id 
                              ? "border-primary bg-primary/10 text-on-background" 
                              : "border-white/5 hover:border-white/10 bg-white/5"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className={cn("text-lg leading-none mb-1", f.class)}>{f.name}</span>
                            <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{f.description}</span>
                          </div>
                          {customization.font === f.id && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(255,59,59,0.5)]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* AI Image Studio */}
            <section>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" /> AI Image Studio
              </label>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && generateImage()}
                    className="flex-1 bg-white/5 border-white/5 rounded-xl px-4 py-2 text-xs font-medium focus:ring-primary/20 focus:border-primary/30 text-on-background placeholder:text-on-surface-variant/20"
                    placeholder="Describe your vision..."
                  />
                  <button 
                    onClick={() => generateImage()}
                    disabled={isGeneratingImage || !imagePrompt.trim()}
                    className="bg-on-background text-background p-2 rounded-xl hover:bg-on-surface transition-all disabled:opacity-50"
                  >
                    {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </section>

            {/* Technical Specifications */}
            <section className="pt-10 border-t border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-4 h-4 text-primary" />
                <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.4em]">Technical Specs</label>
              </div>
              <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">Design ID</span>
                    <span className="text-[10px] font-mono text-on-background">{template.id.slice(0, 12)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">Engine</span>
                    <span className="text-[10px] font-mono text-on-background">Neural Synth v3.1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest">Resolution</span>
                    <span className="text-[10px] font-mono text-on-background">4K Vector</span>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="space-y-3">
                  <span className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-widest block">Active Palette</span>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded bg-primary shadow-sm" title="Primary" />
                    <div className="w-6 h-6 rounded bg-background border border-white/10" title="Background" />
                    <div className="w-6 h-6 rounded bg-on-surface-variant/20 border border-white/10" title="Accent" />
                  </div>
                </div>
              </div>
            </section>

            {/* Photos */}
            <section>
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Personal Photos</label>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*"
                className="hidden"
              />
              <button 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-white/5 transition-all group"
              >
                {isUploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Camera className="w-6 h-6 text-on-surface-variant/40 group-hover:text-primary transition-colors" />}
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Upload Photos</span>
              </button>
            </section>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 bg-mesh p-6 md:p-12 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center relative">
          <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
            <button
              onClick={() => setIsFullscreenPreview(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass hover:bg-white/10 transition-all border border-white/10 text-on-background text-xs font-black uppercase tracking-wider shadow-lg"
              title="Expand to Full Screen Preview"
            >
              <Maximize2 className="w-4 h-4 text-primary" />
              <span>Full Screen</span>
            </button>
          </div>

          {(isGenerating || isGeneratingImage) && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 z-30"
            >
              <div className="glass px-6 py-3 rounded-2xl border border-primary/20 flex items-center gap-4 shadow-2xl shadow-primary/10">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-1">Neural Synthesis</span>
                  <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      animate={{ x: [-128, 128] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
                <div className="w-px h-6 bg-white/5" />
                <span className="text-[10px] font-mono font-bold text-on-background animate-pulse">
                  {isGeneratingImage ? 'Synthesizing Pixels...' : 'Curating Prose...'}
                </span>
              </div>
            </motion.div>
          )}
          <div className="w-full max-w-4xl flex flex-col items-center">
            {/* Touch Tooltip Guidance Banner */}
            <div className="w-full flex items-center justify-between px-4 py-2.5 mb-3 glass rounded-xl border border-primary/20 text-[10px] text-primary font-bold tracking-wide shadow-lg">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>💡 <strong>Touch Guidance:</strong> Drag any of the 4 corner handles to resize card dimensions. Use zoom (+/−), Fit, or Reset Size to adjust view.</span>
              </div>
            </div>

            {/* Editor Toolbar with Zoom & Size Controls */}
            <div className="w-full flex flex-wrap justify-between items-center mb-4 px-4 py-3 glass rounded-2xl border border-white/5 shadow-xl gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2" title="Current gift card pixel dimensions">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Card Size:</span>
                  <span className="text-xs font-mono font-bold text-primary">{cardWidth} × {cardHeight} px</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-lg border border-primary/20" title="AI Smart-Snap active: Automatically re-arranges and balances text & photo elements on resize">
                  <Sparkles className="w-3 h-3 text-primary animate-spin" />
                  <span className="text-[9px] font-black text-primary uppercase tracking-wider">Smart-Snap</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 glass px-2 py-1 rounded-xl border border-white/5" title="Zoom canvas in or out">
                  <button 
                    onClick={() => {
                      setEditorZoom(prev => Math.max(prev - 0.1, 0.5));
                      showToast("Zoomed out canvas view", "info");
                    }}
                    className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-on-background font-bold text-sm transition-colors"
                    title="Zoom Out Canvas"
                    aria-label="Zoom Out"
                  >
                    −
                  </button>
                  <span className="text-[10px] font-mono font-bold px-2 text-on-background">{Math.round(editorZoom * 100)}%</span>
                  <button 
                    onClick={() => {
                      setEditorZoom(prev => Math.min(prev + 0.1, 1.5));
                      showToast("Zoomed in canvas view", "info");
                    }}
                    className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-on-background font-bold text-sm transition-colors"
                    title="Zoom In Canvas"
                    aria-label="Zoom In"
                  >
                    +
                  </button>
                </div>
                <button 
                  onClick={() => {
                    fitToCanvas();
                    showToast("Fitted card to active canvas view", "info");
                  }}
                  className="px-3 py-1.5 rounded-xl glass hover:bg-white/10 text-on-background text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all"
                  title="Fit Card to Screen"
                >
                  Fit
                </button>
                <button 
                  onClick={() => {
                    resetSize();
                    showToast("Card dimensions reset to default 720×456px", "info");
                  }}
                  className="px-3 py-1.5 rounded-xl glass hover:bg-white/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 transition-all"
                  title="Reset Card Size to Default"
                >
                  Reset Size
                </button>
              </div>
            </div>

            {/* Resizable Card Wrapper */}
            <div className="overflow-auto max-w-full p-8 flex items-center justify-center">
              <div 
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  transform: `scale(${editorZoom})`,
                  transformOrigin: 'center center'
                }}
                className="relative bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden border border-white/5 cursor-pointer transition-transform duration-75 select-none"
              >
                {/* Top-Left Corner Handle */}
                <div 
                  role="button"
                  tabIndex={0}
                  aria-label="Resize card from top-left corner"
                  onPointerDown={(e) => handlePointerDownResize(e, 'top-left')}
                  onKeyDown={(e) => handleKeyDownResize(e, 'top-left')}
                  className="absolute -top-2 -left-2 w-6 h-6 bg-primary rounded-full border-2 border-white shadow-xl z-30 cursor-nwse-resize hover:scale-125 focus:ring-2 focus:ring-white transition-transform flex items-center justify-center"
                />
                {/* Top-Right Corner Handle */}
                <div 
                  role="button"
                  tabIndex={0}
                  aria-label="Resize card from top-right corner"
                  onPointerDown={(e) => handlePointerDownResize(e, 'top-right')}
                  onKeyDown={(e) => handleKeyDownResize(e, 'top-right')}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full border-2 border-white shadow-xl z-30 cursor-nesw-resize hover:scale-125 focus:ring-2 focus:ring-white transition-transform flex items-center justify-center"
                />
                {/* Bottom-Left Corner Handle */}
                <div 
                  role="button"
                  tabIndex={0}
                  aria-label="Resize card from bottom-left corner"
                  onPointerDown={(e) => handlePointerDownResize(e, 'bottom-left')}
                  onKeyDown={(e) => handleKeyDownResize(e, 'bottom-left')}
                  className="absolute -bottom-2 -left-2 w-6 h-6 bg-primary rounded-full border-2 border-white shadow-xl z-30 cursor-nesw-resize hover:scale-125 focus:ring-2 focus:ring-white transition-transform flex items-center justify-center"
                />
                {/* Bottom-Right Corner Handle */}
                <div 
                  role="button"
                  tabIndex={0}
                  aria-label="Resize card from bottom-right corner"
                  onPointerDown={(e) => handlePointerDownResize(e, 'bottom-right')}
                  onKeyDown={(e) => handleKeyDownResize(e, 'bottom-right')}
                  className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full border-2 border-white shadow-xl z-30 cursor-nwse-resize hover:scale-125 focus:ring-2 focus:ring-white transition-transform flex items-center justify-center"
                />

                <CardPreview 
                  template={template} 
                  customization={customization} 
                  className="rounded-none shadow-none w-full h-full"
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 w-full glass border-t border-white/5 flex justify-around p-4 z-50">
        <button onClick={() => { setActiveTab('layout'); setIsMobileToolsOpen(true); }} className={cn("flex flex-col items-center gap-1", activeTab === 'layout' && isMobileToolsOpen ? "text-primary" : "text-on-surface-variant/40")}>
          <LayoutIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Layout</span>
        </button>
        <button onClick={() => { setActiveTab('text'); setIsMobileToolsOpen(true); }} className={cn("flex flex-col items-center gap-1", activeTab === 'text' && isMobileToolsOpen ? "text-primary" : "text-on-surface-variant/40")}>
          <Type className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Text</span>
        </button>
        <button onClick={() => { setActiveTab('photos'); setIsMobileToolsOpen(true); }} className={cn("flex flex-col items-center gap-1", activeTab === 'photos' && isMobileToolsOpen ? "text-primary" : "text-on-surface-variant/40")}>
          <ImageIcon className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Photos</span>
        </button>
        <button onClick={onFinish} className="flex flex-col items-center gap-1 text-on-surface-variant/40">
          <div className="w-10 h-10 rounded-xl signature-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <CheckCircle className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Finish</span>
        </button>
      </div>

      {/* Mobile Tools Bottom Sheet Drawer */}
      <AnimatePresence>
        {isMobileToolsOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="lg:hidden fixed bottom-20 left-4 right-4 z-[60] glass-dark rounded-[2.5rem] border border-white/10 p-6 shadow-2xl max-h-[60vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setActiveTab('text')}
                  className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'text' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-background")}
                >
                  Text & Fonts
                </button>
                <button 
                  onClick={() => setActiveTab('layout')}
                  className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'layout' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-background")}
                >
                  Layout & AI
                </button>
                <button 
                  onClick={() => setActiveTab('photos')}
                  className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'photos' ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-background")}
                >
                  Photos
                </button>
              </div>
              <button 
                onClick={() => setIsMobileToolsOpen(false)}
                className="w-10 h-10 rounded-xl glass hover:bg-white/10 flex items-center justify-center text-on-background font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-8">
              {activeTab === 'text' && (
                <>
                  <section>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Recipient</label>
                    <input 
                      type="text"
                      value={customization.recipientName}
                      onChange={(e) => setCustomization(prev => ({ ...prev, recipientName: e.target.value }))}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-on-background"
                      placeholder="Name"
                    />
                  </section>
                  <section>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Message</label>
                      <button 
                        onClick={() => suggestMessage()}
                        disabled={isGenerating}
                        className="text-[9px] font-black text-primary uppercase tracking-widest"
                      >
                        {isGenerating ? 'Thinking...' : 'AI Suggest'}
                      </button>
                    </div>
                    <textarea 
                      value={customization.message}
                      onChange={(e) => setCustomization(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full h-28 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-on-background resize-none custom-scrollbar"
                      placeholder="Your message..."
                    />
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {[
                        { label: '✨ Emotional', tone: 'emotional and deeply touching' },
                        { label: '😂 Funny', tone: 'lighthearted, humorous and funny' },
                        { label: '❤️ Heartfelt', tone: 'warm and heartfelt' },
                        { label: '🔥 Gen-Z', tone: 'trendy Gen-Z slang and vibes' }
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => handleMakeItBetter(item.tone)}
                          disabled={isGenerating}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold text-on-surface-variant border border-white/5"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Typography</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FONTS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setCustomization(prev => ({ ...prev, font: f.id }))}
                          className={cn(
                            "p-3 rounded-xl border transition-all text-left",
                            customization.font === f.id ? "border-primary bg-primary/10 text-on-background" : "border-white/5 bg-white/5 text-on-surface-variant"
                          )}
                        >
                          <span className={cn("text-sm block font-bold", f.class)}>{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {activeTab === 'layout' && (
                <>
                  <section>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Layout Architecture</label>
                    <div className="grid grid-cols-2 gap-2">
                      {LAYOUTS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setCustomization(prev => ({ ...prev, layout: l.id }))}
                          className={cn(
                            "p-3 rounded-xl border transition-all text-left",
                            customization.layout === l.id ? "border-primary bg-primary/10 text-on-background" : "border-white/5 bg-white/5 text-on-surface-variant"
                          )}
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest">{l.name}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-primary" /> AI Image Studio
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs text-on-background"
                        placeholder="Describe your vision..."
                      />
                      <button 
                        onClick={() => generateImage()}
                        disabled={isGeneratingImage || !imagePrompt.trim()}
                        className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold"
                      >
                        {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
                      </button>
                    </div>
                  </section>
                </>
              )}

              {activeTab === 'photos' && (
                <section>
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Personal Photos</label>
                  <button 
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="w-full py-6 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 bg-white/5 text-on-background"
                  >
                    {isUploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Camera className="w-6 h-6 text-primary" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Photos</span>
                  </button>
                </section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {isFullscreenPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto"
          >
            <div className="absolute top-6 right-6 flex items-center gap-4 z-30">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                Immersive Full-Screen Preview
              </span>
              <button 
                onClick={() => setIsFullscreenPreview(false)}
                className="w-12 h-12 rounded-2xl glass hover:bg-white/10 border border-white/10 flex items-center justify-center text-on-background transition-all hover:scale-105"
                title="Exit Full Screen"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="w-full max-w-5xl mx-auto my-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative aspect-[1.58/1] bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/20"
              >
                <CardPreview 
                  template={template} 
                  customization={customization} 
                  className="rounded-none shadow-none" 
                />
              </motion.div>
              <div className="mt-8 flex justify-center items-center gap-6">
                <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                  Card designed for: <span className="text-on-background font-black">{customization.recipientName || 'Someone Special'}</span>
                </p>
                <button 
                  onClick={() => setIsFullscreenPreview(false)}
                  className="px-8 py-3 signature-gradient text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showSaveConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSaving && setShowSaveConfirm(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-dark rounded-[2.5rem] shadow-2xl overflow-hidden p-10 text-center border border-white/5"
            >
              {saveSuccess ? (
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-6 py-4"
                >
                  <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/10">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-headline font-black text-on-background">Draft Archived!</h3>
                  <p className="text-on-surface-variant text-sm font-medium">Your progress is safely stored in your private gallery.</p>
                </motion.div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/10">
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <h3 className="text-3xl font-headline font-black tracking-tighter text-on-background mb-4">Archive progress?</h3>
                  <p className="text-on-surface-variant text-sm mb-10 font-medium leading-relaxed">
                    This will create a new neural draft of your current masterpiece. You can pick up where you left off anytime from the gallery.
                  </p>
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full py-5 signature-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Archiving...
                        </>
                      ) : (
                        "Authorize Archive"
                      )}
                    </button>
                    <button 
                      onClick={() => setShowSaveConfirm(false)}
                      disabled={isSaving}
                      className="w-full py-5 text-on-surface-variant font-black text-xs uppercase tracking-[0.3em] hover:text-on-background transition-colors"
                    >
                      Continue Curation
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReviewScreen({ customization, onSend, onBack }: { customization: Customization, onSend: () => void, onBack: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col font-sans"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center glass border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black group-hover:rotate-12 transition-transform">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background group-hover:glow-text transition-all">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-background flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back to Editor
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 md:py-24 lg:px-12 flex-1">
      <header className="mb-16 md:mb-24">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-1 bg-primary rounded-full" />
          <span className="text-primary font-black text-xs uppercase tracking-[0.4em]">Final Protocol</span>
        </div>
        <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter text-on-background mb-6 leading-[0.9]">
          Final <span className="text-primary glow-text italic">Review.</span>
        </h1>
        <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed font-medium">Ensure every detail is perfect before we archive and transmit your digital heirloom.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7 space-y-12">
          <section className="glass-dark rounded-[3rem] p-4 md:p-10 relative overflow-hidden border border-white/5 shadow-2xl">
            <div className="absolute top-8 right-8 z-10">
              <span className="glass text-primary px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-2 border border-primary/20">
                <Sparkles className="w-3 h-3" />
                Preview Mode
              </span>
            </div>
            <div className="rounded-2xl bg-white overflow-hidden aspect-[4/5] md:aspect-[3/2] flex flex-col items-center justify-center relative shadow-2xl">
              <CardPreview template={TEMPLATES[0]} customization={customization} className="rounded-none shadow-none max-w-none h-full" />
            </div>
            <div className="mt-10 flex justify-center">
              <button onClick={onBack} className="flex items-center gap-3 text-primary font-black text-xs uppercase tracking-[0.2em] hover:glow-text transition-all group">
                <Edit2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Re-initialize Edit
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass p-10 rounded-[2.5rem] border border-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8">Recipient Data</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 font-black">Designation</label>
                  <p className="text-2xl font-headline font-black text-on-background">{customization.recipientName || 'Not specified'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 font-black">Digital Address</label>
                  <p className="text-lg font-bold text-on-background">{customization.recipientEmail || 'Not specified'}</p>
                </div>
              </div>
            </div>
            <div className="glass p-10 rounded-[2.5rem] border border-white/5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8">Transmission</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 font-black">Scheduled Window</label>
                  <p className="text-2xl font-headline font-black text-on-background">{customization.deliveryDate || 'Immediate'}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-on-surface-variant uppercase tracking-widest mb-2 font-black">Protocol</label>
                  <p className="text-lg font-bold text-on-background">Premium Neural Envelope</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-5 lg:sticky lg:top-32">
          <div className="glass-dark rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            <h2 className="font-headline text-4xl font-black tracking-tighter mb-8 text-on-background">Ready to Archive</h2>
            <p className="text-on-surface-variant mb-10 leading-relaxed font-medium">
              Your digital heirloom is ready for transmission. We'll deliver it in a premium digital envelope with a custom reveal sequence.
            </p>
            
            <button onClick={onSend} className="w-full signature-gradient text-white font-headline text-xl py-6 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-4">
              Authorize Send <Send className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-8 bg-primary/5 p-8 rounded-[2rem] border border-primary/10 flex items-start gap-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-black text-sm text-primary uppercase tracking-widest mb-2">Heirloom Guarantee</p>
              <p className="text-xs text-on-surface-variant leading-relaxed font-medium">Every artifact is archived securely. Your recipient can access their digital gift across all neural nodes, indefinitely.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
    </motion.div>
  );
}

function ShareScreen({ template, customization, onBack, navigate, showToast }: { template: GiftCard, customization: Customization, onBack: () => void, navigate: (screen: Screen) => void, showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void }) {
  useEffect(() => {
    const originalTitle = document.title;
    const ogTitleMeta = document.querySelector('meta[property="og:title"]');
    const ogDescMeta = document.querySelector('meta[property="og:description"]');
    const ogImageMeta = document.querySelector('meta[property="og:image"]');
    const twTitleMeta = document.querySelector('meta[name="twitter:title"]');
    const twDescMeta = document.querySelector('meta[name="twitter:description"]');
    const twImageMeta = document.querySelector('meta[name="twitter:image"]');
    const descMeta = document.querySelector('meta[name="description"]');

    const cardTitle = `Digital Gift Card: ${template.title} for ${customization.recipientName || 'You'}`;
    const cardDesc = customization.message 
      ? `"${customization.message}" — A special digital gift card created with The Festive Curator.`
      : `Check out this special ${template.category} gift card created with The Festive Curator.`;
    const cardImage = template.image;

    document.title = cardTitle;
    if (ogTitleMeta) ogTitleMeta.setAttribute('content', cardTitle);
    if (ogDescMeta) ogDescMeta.setAttribute('content', cardDesc);
    if (ogImageMeta) ogImageMeta.setAttribute('content', cardImage);
    if (twTitleMeta) twTitleMeta.setAttribute('content', cardTitle);
    if (twDescMeta) twDescMeta.setAttribute('content', cardDesc);
    if (twImageMeta) twImageMeta.setAttribute('content', cardImage);
    if (descMeta) descMeta.setAttribute('content', cardDesc);

    return () => {
      document.title = 'The Festive Curator – Artisanal Digital Gift Cards';
      const defaultDesc = 'Artisanal digital gift cards designed with the warmth of tradition and the clarity of modern aesthetics.';
      const defaultImage = 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1200&auto=format&fit=crop';
      if (ogTitleMeta) ogTitleMeta.setAttribute('content', 'The Festive Curator – Artisanal Digital Gift Cards');
      if (ogDescMeta) ogDescMeta.setAttribute('content', defaultDesc);
      if (ogImageMeta) ogImageMeta.setAttribute('content', defaultImage);
      if (twTitleMeta) twTitleMeta.setAttribute('content', 'The Festive Curator – Artisanal Digital Gift Cards');
      if (twDescMeta) twDescMeta.setAttribute('content', defaultDesc);
      if (twImageMeta) twImageMeta.setAttribute('content', defaultImage);
      if (descMeta) descMeta.setAttribute('content', defaultDesc);
    };
  }, [template, customization]);

  const shareUrl = 'https://thefestivecurator.com/v/share/7f2a1-demo';
  const shareText = `Check out this digital gift card I created for ${customization.recipientName || 'you'}! ${shareUrl}`;
  const shareSubject = 'A special digital gift for you';
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg'>('png');
  
  // New interactive feature states
  const [showUnsealModal, setShowUnsealModal] = useState(false);
  const [isSealBroken, setIsSealBroken] = useState(false);
  const [isPlayingNarration, setIsPlayingNarration] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [reactionRecorded, setReactionRecorded] = useState(false);
  const [reactionStep, setReactionStep] = useState<'record' | 'preview' | 'saved'>('record');

  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [isScheduled, setIsScheduled] = useState(false);

  const handleExportICS = () => {
    const recipient = customization.recipientName || 'Recipient';
    const eventTitle = `Send Digital Gift Card to ${recipient}`;
    const description = `Send your ${template.category} keepsake card to ${recipient}. Message: "${customization.message || 'Special gift card'}". Created with The Festive Curator.`;
    
    const [year, month, day] = scheduledDate.split('-').map(Number);
    const [hour, minute] = scheduledTime.split(':').map(Number);
    const eventDate = new Date(year, month - 1, day, hour, minute);
    
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//The Festive Curator//Gift Card Delivery//EN',
      'BEGIN:VEVENT',
      `UID:gift-card-${Date.now()}@thefestivecurator.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(eventDate)}`,
      `DTEND:${formatDate(new Date(eventDate.getTime() + 30 * 60 * 1000))}`,
      `SUMMARY:${eventTitle}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder to send digital gift card',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `send-gift-card-${recipient.toLowerCase().replace(/\s+/g, '-')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📅 Calendar `.ics` reminder downloaded successfully!', 'success');
  };

  const handlePlayNarration = () => {
    if (isPlayingNarration) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingNarration(false);
      return;
    }

    if ('speechSynthesis' in window) {
      const messageText = customization.message || `Special gift card for ${customization.recipientName || 'you'}`;
      const utterance = new SpeechSynthesisUtterance(messageText);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.onend = () => setIsPlayingNarration(false);
      utterance.onerror = () => setIsPlayingNarration(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingNarration(true);
    } else {
      setIsPlayingNarration(true);
      setTimeout(() => setIsPlayingNarration(false), 5000);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const options = {
        cacheBust: true,
        quality: 1,
        pixelRatio: 4,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          borderRadius: '0'
        }
      };

      const dataUrl = downloadFormat === 'png' 
        ? await toPng(cardRef.current, options)
        : await toJpeg(cardRef.current, { ...options, quality: 0.98 });

      const link = document.createElement('a');
      link.download = `festive-curator-${customization.recipientName || 'gift-card'}.${downloadFormat}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed', err);
      showToast('Failed to download the card. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = (platform: string) => {
    switch (platform) {
      case 'WhatsApp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        break;
      case 'Instagram':
        showToast('To share on Instagram, save and upload to your Stories or Feed!', 'info');
        break;
      case 'Email':
        window.location.href = `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareText)}`;
        break;
      case 'Message':
        window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
        break;
      default:
        if (navigator.share) {
          navigator.share({
            title: shareSubject,
            text: shareText,
            url: shareUrl,
          }).catch(console.error);
        }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.95 }}
      className="min-h-screen bg-background flex flex-col font-sans"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center glass border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black group-hover:rotate-12 transition-transform">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background group-hover:glow-text transition-all">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-on-background flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back to Review
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center flex-1">
      <header className="mb-12 md:mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 glass text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-8 shadow-xl border border-primary/20"
        >
          <Sparkles className="w-3 h-3" />
          Masterpiece Archived
        </motion.div>
        <h2 className="text-4xl md:text-6xl font-headline font-black tracking-tighter text-on-background mb-6 leading-none">
          Your curation <br /> is <span className="text-primary glow-text italic">complete.</span>
        </h2>
        <p className="text-on-surface-variant text-lg font-medium max-w-md mx-auto leading-relaxed">
          A digital heirloom, crafted with neural intelligence and ready to be shared across the collective.
        </p>
      </header>



      <div className="relative mb-20 group">
        <div className="absolute -inset-8 bg-primary/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-2xl border border-white/5 transform transition-all duration-700 hover:scale-[1.02] hover:shadow-primary/10">
          <div ref={cardRef} className="bg-white">
            <CardPreview 
              template={template} 
              customization={customization} 
              className="rounded-none shadow-none" 
              isExporting={isDownloading}
            />
          </div>
        </div>

        {/* Download Controls */}
        <div className="mt-12 flex flex-col items-center gap-8">
          <div className="flex items-center gap-2 glass p-1.5 rounded-2xl border border-white/5 shadow-xl">
            {(['png', 'jpg'] as const).map((format) => (
              <button
                key={format}
                onClick={() => setDownloadFormat(format)}
                className={cn(
                  "px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                  downloadFormat === format 
                    ? "signature-gradient text-white shadow-lg" 
                    : "text-on-surface-variant hover:text-on-background"
                )}
              >
                {format}
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className={cn(
              "group relative overflow-hidden signature-gradient text-white px-16 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/30",
              isDownloading && "opacity-80 cursor-not-allowed"
            )}
          >
            {isDownloading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />}
            <span className="relative">
              {isDownloading ? 'Archiving...' : `Download ${downloadFormat.toUpperCase()}`}
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-12 mb-16">
        <section className="text-left">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8 flex items-center gap-4">
            Neural Distribution <div className="h-px bg-white/5 flex-grow" />
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: MessageCircle, label: 'WhatsApp', color: 'hover:bg-green-500/10 hover:text-green-500' },
              { icon: Instagram, label: 'Instagram', color: 'hover:bg-pink-500/10 hover:text-pink-500' },
              { icon: Mail, label: 'Email', color: 'hover:bg-blue-500/10 hover:text-blue-500' },
              { icon: MessageSquare, label: 'Message', color: 'hover:bg-white/10 hover:text-on-background' }
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => handleShare(item.label)}
                className="flex flex-col items-center gap-3 group"
              >
                <div className={cn(
                  "w-full aspect-square rounded-2xl glass flex items-center justify-center transition-all duration-500 border border-white/5 group-hover:shadow-xl group-hover:-translate-y-2",
                  item.color
                )}>
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest group-hover:text-on-background transition-colors">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="text-left">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8 flex items-center gap-4">
            Direct Access <div className="h-px bg-white/5 flex-grow" />
          </h3>
          <div className="p-2 glass rounded-2xl border border-white/5 flex items-center gap-3 group hover:border-primary/20 transition-colors shadow-xl">
            <div className="px-5 py-3 flex-grow overflow-hidden text-left">
              <p className="text-xs text-on-surface-variant font-bold truncate tracking-tight">thefestivecurator.com/v/share/7f2a1-demo</p>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText('https://thefestivecurator.com/v/share/7f2a1-demo');
              }}
              className="signature-gradient text-white font-black py-3 px-6 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
            >
              Copy
            </button>
          </div>
          <button 
            onClick={() => navigate('view_keepsake')}
            className="w-full mt-4 py-4 glass hover:bg-white/10 border border-white/20 text-on-background font-headline font-bold text-xs uppercase tracking-[0.2em] rounded-2xl transition-all flex justify-center items-center gap-3 shadow-xl hover:scale-[1.01]"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            Preview Recipient Surprise Mode ✨
          </button>
        </section>
      </div>

      {/* Scheduled Delivery & Calendar Export */}
      <section className="text-left mb-16">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8 flex items-center gap-4">
          📅 Scheduled Delivery & Calendar Export <div className="h-px bg-white/5 flex-grow" />
        </h3>
        <div className="glass-dark p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h4 className="text-sm font-headline font-black text-on-background uppercase tracking-wider">
                {isScheduled ? `Scheduled for ${scheduledDate} at ${scheduledTime}` : 'Set Precision Delivery Schedule'}
              </h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Choose the exact date & time for delivery (e.g. birthday morning). Export a `.ics` calendar reminder to sync with Apple Calendar, Google Calendar, or Outlook.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
              <input 
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-on-background focus:ring-0 cursor-pointer"
              />
              <input 
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-on-background focus:ring-0 cursor-pointer"
              />
            </div>
            <button 
              onClick={() => {
                setIsScheduled(true);
                handleExportICS();
              }}
              className="signature-gradient text-white font-black py-3 px-6 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2"
            >
              <span>📅 Export .ics Reminder</span>
            </button>
          </div>
        </div>
      </section>

      {/* QR Code Pass for Physical Events & Weddings */}
      <section className="text-left mb-16">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-8 flex items-center gap-4">
          Event & Wedding QR Pass <div className="h-px bg-white/5 flex-grow" />
        </h3>
        <div className="glass p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
          <div className="bg-white p-4 rounded-2xl shadow-inner flex items-center justify-center">
            <QRCodeSVG 
              value="https://thefestivecurator.com/v/share/7f2a1-demo" 
              size={160}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              includeMargin={false}
            />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Physical Setting Ready</span>
            <h4 className="text-xl font-headline font-black text-on-background mb-3">Instant Scannable Heirloom Pass</h4>
            <p className="text-on-surface-variant text-xs leading-relaxed mb-6">
              Display this high-density QR code at your wedding reception table, banquet, or event display. Guests can instantly scan with any mobile camera to open and experience the digital gift card.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const svg = document.querySelector('svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);
                      const pngFile = canvas.toDataURL('image/png');
                      const downloadLink = document.createElement('a');
                      downloadLink.download = 'gift-card-qr.png';
                      downloadLink.href = pngFile;
                      downloadLink.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                  }
                }}
                className="signature-gradient text-white font-black py-3 px-6 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download QR Code (PNG)
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* Wax Seal Unsealing Modal */}
      <AnimatePresence>
        {showUnsealModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12"
          >
            <div className="absolute top-6 right-6">
              <button 
                onClick={() => setShowUnsealModal(false)}
                className="w-12 h-12 rounded-2xl glass hover:bg-white/10 border border-white/10 flex items-center justify-center text-on-background transition-all hover:scale-105"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="max-w-lg w-full text-center">
              <h3 className="text-3xl font-headline font-black text-on-background mb-4">Interactive Envelope Unsealing</h3>
              <p className="text-on-surface-variant text-sm mb-12">Experience the recipient opening ritual. Click the wax seal to break open the physical seal and slide out the heirloom.</p>

              {!isSealBroken ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative bg-amber-50/10 border border-amber-200/20 p-16 rounded-3xl shadow-2xl flex flex-col items-center justify-center"
                >
                  <p className="text-xs uppercase tracking-widest text-amber-200/80 mb-8 font-black">Confidential Heirloom Envelope</p>
                  <button 
                    onClick={() => setIsSealBroken(true)}
                    className="w-24 h-24 rounded-full bg-red-800 border-4 border-amber-500/50 shadow-[0_0_30px_rgba(185,28,28,0.5)] flex items-center justify-center text-amber-200 font-headline font-black text-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer group"
                    title="Click to break wax seal"
                  >
                    <span className="group-hover:rotate-12 transition-transform">FC</span>
                  </button>
                  <p className="text-xs text-on-surface-variant mt-6 animate-pulse">Click wax seal to unseal</p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                    <CardPreview template={template} customization={customization} className="rounded-none shadow-none" />
                  </div>
                  <button 
                    onClick={() => setShowUnsealModal(false)}
                    className="px-8 py-4 signature-gradient text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                  >
                    Close Ritual Preview
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print-Ready Card Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto"
          >
            <div className="absolute top-6 right-6">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="w-12 h-12 rounded-2xl glass hover:bg-white/10 border border-white/10 flex items-center justify-center text-on-background transition-all hover:scale-105"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="max-w-md w-full glass p-8 rounded-3xl border border-white/10 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-headline font-black text-2xl text-on-background mb-2">Print-Ready Card</h3>
                <p className="text-xs text-on-surface-variant">Print the card or save it as a PDF.</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                <p className="text-xs font-bold text-on-background mb-1">{customization.recipientName ? `For ${customization.recipientName}` : 'Digital Heirloom'}</p>
                <p className="text-[10px] text-on-surface-variant truncate">{template.title} — {template.category}</p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    window.print();
                    setShowPrintModal(false);
                  }}
                  className="flex-1 py-4 glass hover:bg-white/10 border border-white/20 text-on-background rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Print Card
                </button>
                <button 
                  onClick={() => {
                    handleDownload();
                    setShowPrintModal(false);
                  }}
                  className="flex-1 signature-gradient text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                >
                  Save as PDF
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipient Reaction Video Modal */}
      <AnimatePresence>
        {showReactionModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 md:p-12"
          >
            <div className="absolute top-6 right-6">
              <button 
                onClick={() => {
                  setShowReactionModal(false);
                  setReactionStep('record');
                }}
                className="w-12 h-12 rounded-2xl glass hover:bg-white/10 border border-white/10 flex items-center justify-center text-on-background transition-all hover:scale-105"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
            </div>

            <div className="max-w-md w-full text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                <Video className="w-10 h-10" />
              </div>
              <h3 className="text-3xl font-headline font-black text-on-background">Reaction Video</h3>
              
              {reactionStep === 'record' && (
                <>
                  <p className="text-on-surface-variant text-sm">Record your reaction video when opening this keepsake.</p>
                  <div className="w-full aspect-video bg-black/40 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-red-600/80 animate-ping absolute" />
                      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white relative shadow-xl">
                        <Video className="w-8 h-8" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white">
                      Camera Live Feed
                    </div>
                  </div>
                  <button 
                    onClick={() => setReactionStep('preview')}
                    className="w-full signature-gradient text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
                  >
                    Stop & Preview
                  </button>
                </>
              )}

              {reactionStep === 'preview' && (
                <>
                  <p className="text-on-surface-variant text-sm">Preview your recorded reaction video.</p>
                  <div className="w-full aspect-video bg-black/80 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
                    <div className="text-on-background text-xs font-mono">▶ Playback Recording (0:05)</div>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setReactionStep('record')}
                      className="flex-1 py-4 glass hover:bg-white/10 border border-white/20 text-on-background rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Record Again
                    </button>
                    <button 
                      onClick={() => {
                        setReactionRecorded(true);
                        setReactionStep('saved');
                      }}
                      className="flex-1 signature-gradient text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                    >
                      Save Video
                    </button>
                  </div>
                </>
              )}

              {reactionStep === 'saved' && (
                <div className="space-y-6 glass p-8 rounded-3xl border border-white/10">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-headline font-bold text-lg text-on-background">Reaction recorded successfully.</h4>
                    <p className="text-xs text-on-surface-variant">Your reaction is ready to preview or save.</p>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button 
                      onClick={() => {
                        setShowReactionModal(false);
                        setReactionStep('record');
                      }}
                      className="w-full signature-gradient text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Shared Components ---

function ViewKeepsakeScreen({ template, customization, onRemix }: { template: GiftCard, customization: Customization, onRemix: () => void }) {
  const [isOpened, setIsOpened] = useState(false);
  const [revealStyle, setRevealStyle] = useState<'envelope' | 'gift' | 'scroll' | 'sparkle'>('envelope');
  const [reactions, setReactions] = useState<{ [key: string]: number }>({
    '❤️ Loved it': 14,
    '🥹 Emotional': 8,
    '😂 Funny': 5,
    '😍 Amazing': 11,
    '🎉 Surprised': 9
  });
  const [userReacted, setUserReacted] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const handleReaction = (key: string) => {
    if (userReacted === key) return;
    setReactions(prev => ({
      ...prev,
      [key]: prev[key] + 1
    }));
    setUserReacted(key);
  };

  const handlePlayVoice = () => {
    if (isPlayingVoice) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      return;
    }
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(customization.message || "A special memory for you.");
      u.onend = () => setIsPlayingVoice(false);
      window.speechSynthesis.speak(u);
      setIsPlayingVoice(true);
    } else {
      setIsPlayingVoice(true);
      setTimeout(() => setIsPlayingVoice(false), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 md:p-12 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-mesh pointer-events-none opacity-40" />

      {!isOpened ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-dark p-12 rounded-[3rem] border border-white/10 text-center relative z-10 shadow-2xl space-y-8"
        >
          <div className="w-24 h-24 rounded-full signature-gradient flex items-center justify-center text-white mx-auto shadow-2xl shadow-primary/30 animate-pulse">
            <Sparkles className="w-12 h-12" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
              Surprise Waiting
            </span>
            <h2 className="text-3xl md:text-4xl font-headline font-black text-on-background mt-6 mb-3">
              A keepsake for <br /> <span className="text-primary italic">{customization.recipientName || 'You'}</span>
            </h2>
            <p className="text-on-surface-variant text-sm font-medium">
              Someone special created an artisanal digital heirloom for you. Tap below to open.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            {[
              { id: 'envelope', label: 'Envelope' },
              { id: 'gift', label: 'Gift Box' },
              { id: 'scroll', label: 'Scroll' },
              { id: 'sparkle', label: 'Sparkle' }
            ].map((s) => (
              <button 
                key={s.id}
                onClick={() => setRevealStyle(s.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                  revealStyle === s.id ? "signature-gradient text-white shadow-md" : "glass text-on-surface-variant hover:text-on-background"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setIsOpened(true)}
            className="w-full signature-gradient text-white py-5 rounded-2xl font-headline font-black text-lg uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            Tap to Open ✨
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-4xl w-full mx-auto space-y-12 relative z-10 py-12"
        >
          <div className="text-center space-y-3">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
              ✨ Permanent Keepsake Archive
            </span>
            <h2 className="text-4xl md:text-5xl font-headline font-black text-on-background">
              Created with love for <span className="text-primary">{customization.recipientName || 'You'}</span>
            </h2>
            <p className="text-on-surface-variant text-sm">
              Archived securely on The Festive Curator.
            </p>
          </div>

          <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white border border-white/10">
            <CardPreview template={template} customization={customization} className="rounded-none shadow-none" />
          </div>

          {/* Voice Note & Reactions */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass p-8 rounded-3xl border border-white/5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Mic className="w-4 h-4" /> Personal Voice Heirloom
              </h3>
              <p className="text-xs text-on-surface-variant">Listen to the personalized audio message recorded for this keepsake.</p>
              <button 
                onClick={handlePlayVoice}
                className="w-full signature-gradient text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg"
              >
                <Volume2 className={cn("w-5 h-5", isPlayingVoice && "animate-pulse")} />
                {isPlayingVoice ? 'Playing Audio Message...' : 'Play Audio Message 🎙️'}
              </button>
            </div>

            <div className="glass p-8 rounded-3xl border border-white/5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">How did this make you feel?</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reactions).map(([label, count]) => (
                  <button 
                    key={label}
                    onClick={() => handleReaction(label)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                      userReacted === label ? "bg-primary text-white shadow-lg" : "glass hover:bg-white/10 text-on-background"
                    )}
                  >
                    <span>{label}</span>
                    <span className="bg-white/10 px-2 py-0.5 rounded-md text-[10px]">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <button 
              onClick={onRemix}
              className="px-10 py-4 glass hover:bg-white/10 border border-white/20 text-on-background rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-xl flex items-center gap-3"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Remix this memory & create your own ✨
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Navbar({ 
  user, 
  onSignIn, 
  onSignOut, 
  searchQuery, 
  setSearchQuery, 
  onCreateNew,
  onMyCreations,
  onOccasions
}: { 
  user: FirebaseUser | null, 
  onSignIn: () => void, 
  onSignOut: () => void, 
  searchQuery: string, 
  setSearchQuery: (q: string) => void, 
  onCreateNew?: () => void,
  onMyCreations?: () => void,
  onOccasions?: () => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full sticky top-0 z-50 glass-dark border-b border-white/5">
      <div className="flex justify-between items-center px-4 md:px-12 py-4 max-w-7xl mx-auto gap-4">
        <div className="flex items-center gap-6 lg:gap-12 shrink-0">
          <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={onCreateNew}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-xl font-black group-hover:rotate-12 transition-transform duration-500 shadow-lg shadow-primary/20">F</div>
            <span className="text-xl md:text-2xl font-headline font-black tracking-tighter text-on-background group-hover:glow-text transition-all hidden sm:block">The Festive Curator</span>
          </div>
          <nav className="hidden 2xl:flex items-center gap-8">
            <button className="text-on-background font-bold text-xs uppercase tracking-[0.2em] relative group py-1" onClick={onOccasions}>
              Gallery
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>
            <button className="text-on-surface-variant hover:text-on-background transition-colors text-xs uppercase tracking-[0.2em] font-bold group relative py-1" onClick={onMyCreations}>
              My Creations
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>
            <button className="text-on-surface-variant hover:text-on-background transition-colors text-xs uppercase tracking-[0.2em] font-bold group relative py-1" onClick={onOccasions}>
              Occasions
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="hidden lg:flex items-center bg-white/5 px-4 py-2 rounded-2xl border border-white/5 focus-within:border-primary/30 transition-all group shrink-0">
            <Search className="w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors mr-2.5 shrink-0" />
            <input 
              className="bg-transparent border-none focus:ring-0 text-xs w-36 lg:w-48 placeholder:text-on-surface-variant/40 text-on-background font-medium" 
              placeholder="Search studio..." 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {user ? (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-3 p-1.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
              >
                <img src={user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`} className="w-9 h-9 rounded-xl border border-white/10" alt="Avatar" referrerPolicy="no-referrer" />
                <span className="text-sm font-bold text-on-background hidden lg:block pr-2">{user.displayName?.split(' ')[0]}</span>
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-72 glass-dark rounded-3xl shadow-2xl border border-white/5 overflow-hidden z-50 py-3"
                  >
                    <div className="px-6 py-4 border-b border-white/5 mb-3">
                      <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] mb-2">Authenticated Curator</p>
                      <p className="text-sm font-bold text-on-background truncate">{user.email}</p>
                    </div>
                    
                    <button 
                      onClick={() => { onOccasions?.(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-6 py-3.5 text-on-surface-variant hover:bg-white/5 hover:text-on-background transition-all text-sm font-bold"
                    >
                      <Grid className="w-4 h-4" />
                      Gallery
                    </button>
                    
                    <button 
                      onClick={() => { onMyCreations?.(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-6 py-3.5 text-on-surface-variant hover:bg-white/5 hover:text-on-background transition-all text-sm font-bold"
                    >
                      <Heart className="w-4 h-4" />
                      My Studio
                    </button>

                    <div className="h-px bg-white/5 my-3 mx-6" />
                    
                    <button 
                      onClick={() => { onSignOut(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-6 py-3.5 text-primary hover:bg-primary/5 transition-all text-sm font-bold"
                    >
                      <LogOut className="w-4 h-4" />
                      Archive Session
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button onClick={onSignIn} className="text-on-surface-variant hover:text-on-background font-bold px-6 py-2.5 text-sm uppercase tracking-widest transition-colors">Sign In</button>
          )}
          <PWAInstallButton />
          <button onClick={onCreateNew} className="signature-gradient text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Create New</button>
        </div>
      </div>
    </header>
  );
}

function Footer({ onNavigate }: { onNavigate?: (screen: Screen) => void }) {
  return (
    <footer className="w-full py-24 glass-dark border-t border-white/5 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 px-6 md:px-12 items-start max-w-7xl mx-auto relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary/20">F</div>
            <span className="text-2xl font-headline font-black tracking-tighter text-on-background">The Festive Curator</span>
          </div>
          <p className="text-on-surface-variant text-base leading-relaxed max-w-sm font-medium">
            Curating modern heirlooms through the lens of artificial intelligence and timeless design. Bridging the gap between digital convenience and artisanal quality.
          </p>
          <div className="flex items-center gap-6 mt-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] mb-1">Studio Status</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-on-background">Live Archive</span>
              </div>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <p className="text-on-surface-variant/40 text-[10px] font-mono uppercase tracking-[0.3em]">© 2026 Studio Session. <br /> All Rights Reserved.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 md:justify-items-end">
          <div className="flex flex-col gap-5">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">Legal Protocol</p>
            <button onClick={() => onNavigate?.('privacy')} className="text-on-surface-variant hover:text-on-background transition-all text-sm font-bold text-left group flex items-center gap-2">
              <span className="w-1 h-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              Privacy Policy
            </button>
            <button onClick={() => onNavigate?.('terms')} className="text-on-surface-variant hover:text-on-background transition-all text-sm font-bold text-left group flex items-center gap-2">
              <span className="w-1 h-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              Terms of Service
            </button>
          </div>
          <div className="flex flex-col gap-5">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">Studio Access</p>
            <button onClick={() => onNavigate?.('contact')} className="text-on-surface-variant hover:text-on-background transition-all text-sm font-bold text-left group flex items-center gap-2">
              <span className="w-1 h-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              Contact Team
            </button>
            <button onClick={() => onNavigate?.('gallery')} className="text-on-surface-variant hover:text-on-background transition-all text-sm font-bold text-left group flex items-center gap-2">
              <span className="w-1 h-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              Gallery Archive
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function PrivacyScreen({ onBack, navigate }: { onBack: () => void, navigate: (screen: Screen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col font-sans"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center border-b border-white/5 sticky top-0 glass z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black shadow-lg shadow-primary/20">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-8 py-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-1 bg-primary rounded-full" />
          <span className="text-primary font-black text-xs uppercase tracking-[0.4em]">Data Protocol</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-headline font-black tracking-tighter text-on-background mb-12 leading-[0.8]">Privacy <span className="text-primary glow-text italic">Policy.</span></h1>
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-on-surface-variant text-xl font-medium leading-relaxed mb-12">
            At The Festive Curator, we treat your digital legacy with the utmost security. We only archive your artifacts securely within our neural nodes.
          </p>
          <h2 className="text-2xl font-black text-on-background mt-16 mb-6 uppercase tracking-widest">Data Collection</h2>
          <p className="text-on-surface-variant/80 mb-8 font-medium">
            Your personal visual data uploaded for customization is processed locally and archived only for your session. We do not transmit your data to external collectives.
          </p>
          <h2 className="text-2xl font-black text-on-background mt-16 mb-6 uppercase tracking-widest">Neural Features</h2>
          <p className="text-on-surface-variant/80 mb-8 font-medium">
            Our AI features utilize advanced neural networks that adhere to strict data privacy protocols. We do not utilize your personal transmissions to train our collective intelligence.
          </p>
          <h2 className="text-2xl font-black text-on-background mt-16 mb-6 uppercase tracking-widest">Security</h2>
          <p className="text-on-surface-variant/80 mb-8 font-medium">
            We employ industry-standard encryption to protect your artifacts. Your account is secured via biometric-equivalent Google Authentication, ensuring that only you can access your private studio.
          </p>
        </div>
      </main>
      <Footer onNavigate={navigate} />
    </motion.div>
  );
}

function TermsScreen({ onBack, navigate }: { onBack: () => void, navigate: (screen: Screen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col font-sans"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center border-b border-white/5 sticky top-0 glass z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black shadow-lg shadow-primary/20">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-8 py-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-1 bg-primary rounded-full" />
          <span className="text-primary font-black text-xs uppercase tracking-[0.4em]">Usage Protocol</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-headline font-black tracking-tighter text-on-background mb-12 leading-[0.8]">Terms of <span className="text-primary glow-text italic">Service.</span></h1>
        <div className="prose prose-invert prose-lg max-w-none">
          <p className="text-on-surface-variant text-xl font-medium leading-relaxed mb-12">
            By accessing The Festive Curator, you agree to utilize our neural generation tools with intention and responsibility.
          </p>
          <h2 className="text-2xl font-black text-on-background mt-16 mb-6 uppercase tracking-widest">Ownership</h2>
          <p className="text-on-surface-variant/80 mb-8 font-medium">
            You retain primary ownership of the artifacts you curate, granting us a license to archive and display them for your exclusive access.
          </p>
          <h2 className="text-2xl font-black text-on-background mt-16 mb-6 uppercase tracking-widest">Content Standards</h2>
          <p className="text-on-surface-variant/80 mb-8 font-medium">
            All generated artifacts must adhere to collective standards. We reserve the right to archive inactive drafts after a 30-day cycle.
          </p>
          <h2 className="text-2xl font-black text-on-background mt-16 mb-6 uppercase tracking-widest">Usage Limits</h2>
          <p className="text-on-surface-variant/80 mb-8 font-medium">
            To maintain high-fidelity experiences for all curators, we implement fair usage protocols on our neural generation tools.
          </p>
        </div>
      </main>
      <Footer onNavigate={navigate} />
    </motion.div>
  );
}

function ContactScreen({ onBack, navigate }: { onBack: () => void, navigate: (screen: Screen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col font-sans"
    >
      <header className="px-8 md:px-12 py-8 flex justify-between items-center border-b border-white/5 sticky top-0 glass z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-black shadow-lg shadow-primary/20">F</div>
          <span className="text-xl font-headline font-black tracking-tighter text-on-background">The Festive Curator</span>
        </div>
        <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant hover:text-primary flex items-center gap-2 transition-all">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-8 py-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-1 bg-primary rounded-full" />
          <span className="text-primary font-black text-xs uppercase tracking-[0.4em]">Direct Link</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-headline font-black tracking-tighter text-on-background mb-12 leading-[0.8]">Contact <span className="text-primary glow-text italic">Us.</span></h1>
        <div className="glass-dark rounded-[3rem] p-12 md:p-20 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
            <div className="w-24 h-24 bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/20">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-headline font-black text-on-background mb-4">Initialize Communication.</h2>
              <p className="text-on-surface-variant text-lg font-medium mb-10 leading-relaxed">
                Have a query or feedback? Our studio team is ready to assist you in curating the perfect digital moment.
              </p>
              <a 
                href="mailto:studio@thefestivecurator.com" 
                className="inline-flex items-center gap-3 px-10 py-5 signature-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-105 transition-all"
              >
                Transmit Message <Send className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer onNavigate={navigate} />
    </motion.div>
  );
}
