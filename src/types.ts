export type Screen = 'gallery' | 'signin' | 'signout' | 'editor' | 'review' | 'share' | 'privacy' | 'terms' | 'contact' | 'dashboard' | 'timeline' | 'view_keepsake';

export interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'sticker';
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  filter?: string;
}

export interface GiftCard {
  id: string;
  title: string;
  category: string;
  image: string;
  thumbnail?: string;
  background?: string;
  elements?: CanvasElement[];
  tags: string[];
  featured?: boolean;
  trending?: boolean;
  popular?: boolean;
  editorsPick?: boolean;
  isNew?: boolean;
}

export interface MemoryEvent {
  id: string;
  year: string;
  title: string;
  description: string;
  photo?: string;
  location?: string;
  voiceNoteUrl?: string;
}

export interface Customization {
  message: string;
  font: string;
  photos: string[];
  layout: string;
  recipientName: string;
  recipientEmail: string;
  deliveryDate: string;
  textColor?: string;
  backgroundColor?: string;
  gradient?: string;
  stickers?: string[];
  bgMusic?: string;
  animation?: string;
  voiceNoteUrl?: string;
  memoryEvents?: MemoryEvent[];
  cardSize?: {
    width: number;
    height: number;
  };
}

export const TEMPLATES: GiftCard[] = [
  {
    id: '1',
    title: 'Radiant Celebration',
    category: 'Birthday',
    image: 'https://images.unsplash.com/photo-1530103862676-fa8c91bbebdd?q=80&w=800&auto=format&fit=crop',
    tags: ['Birthday', 'Party', 'Celebration'],
    trending: true,
    popular: true,
    editorsPick: true,
    isNew: true,
    featured: true
  },
  {
    id: '2',
    title: 'Timeless Union',
    category: 'Anniversary',
    image: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=800&auto=format&fit=crop',
    tags: ['Anniversary', 'Love', 'Romance'],
    popular: true,
    editorsPick: true
  },
  {
    id: '3',
    title: 'Frosted Pine',
    category: 'Christmas',
    image: 'https://images.unsplash.com/photo-1544273677-c433136021d4?q=80&w=800&auto=format&fit=crop',
    tags: ['Christmas', 'Holidays', 'Winter'],
    trending: true
  },
  {
    id: '4',
    title: 'Quiet Gratitude',
    category: 'Thank You',
    image: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=800&auto=format&fit=crop',
    tags: ['Thank You', 'Gratitude', 'Appreciation'],
    popular: true
  },
  {
    id: '5',
    title: 'Golden Horizon',
    category: 'Wedding',
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800&auto=format&fit=crop',
    tags: ['Wedding', 'Celebration', 'Love'],
    editorsPick: true,
    featured: true,
    isNew: true
  },
  {
    id: '6',
    title: 'Academic Milestone',
    category: 'Graduation',
    image: 'https://images.unsplash.com/photo-1523050335456-adaba834597c?q=80&w=800&auto=format&fit=crop',
    tags: ['Graduation', 'Success', 'Milestone'],
    isNew: true,
    trending: true
  },
  {
    id: '7',
    title: 'Sacred Bond',
    category: 'Friendship',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop',
    tags: ['Friendship', 'Bonds', 'Memories'],
    popular: true,
    editorsPick: true
  },
  {
    id: '8',
    title: 'Eternal Valentine',
    category: "Valentine's",
    image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop',
    tags: ["Valentine's", 'Romance', 'Love'],
    trending: true,
    featured: true
  },
  {
    id: '9',
    title: 'Festival of Lights',
    category: 'Diwali',
    image: 'https://images.unsplash.com/photo-1603228807505-d6eb4cff9fe5?q=80&w=800&auto=format&fit=crop',
    tags: ['Diwali', 'Festivals', 'Lights'],
    popular: true,
    isNew: true
  },
  {
    id: '10',
    title: 'Colors of Joy',
    category: 'Holi',
    image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=800&auto=format&fit=crop',
    tags: ['Holi', 'Colors', 'Festivals'],
    trending: true
  },
  {
    id: '11',
    title: 'Midnight Sparkler',
    category: 'New Year',
    image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=800&auto=format&fit=crop',
    tags: ['New Year', 'Celebration', 'Midnight'],
    popular: true
  },
  {
    id: '12',
    title: 'Motherly Warmth',
    category: "Mother's Day",
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop',
    tags: ["Mother's Day", 'Family', 'Love'],
    editorsPick: true
  },
  {
    id: '13',
    title: 'Pillar of Strength',
    category: "Father's Day",
    image: 'https://images.unsplash.com/photo-1506863530036-1efeddceb993?q=80&w=800&auto=format&fit=crop',
    tags: ["Father's Day", 'Family', 'Gratitude'],
    isNew: true
  },
  {
    id: '14',
    title: 'Triumphant Success',
    category: 'Congratulations',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop',
    tags: ['Congratulations', 'Success', 'Achievement'],
    popular: true
  }
];

export interface FontOption {
  id: string;
  name: string;
  description: string;
  class: string;
  category: 'Modern' | 'Elegant' | 'Playful' | 'Minimalist';
}

export const FONTS: FontOption[] = [
  // Modern
  { id: 'epilogue', name: 'Epilogue', description: 'Bold & Modern', class: 'font-headline', category: 'Modern' },
  { id: 'jakarta', name: 'Jakarta', description: 'Clean & Pro', class: 'font-sans', category: 'Modern' },
  { id: 'inter', name: 'Inter', description: 'Universal Clarity', class: 'font-modern', category: 'Modern' },
  { id: 'outfit', name: 'Outfit', description: 'Geometric Tech', class: 'font-outfit', category: 'Modern' },
  
  // Elegant
  { id: 'playfair', name: 'Playfair', description: 'Elegant Classic', class: 'font-serif', category: 'Elegant' },
  { id: 'cormorant', name: 'Cormorant', description: 'High-End Serif', class: 'font-elegant', category: 'Elegant' },
  { id: 'script', name: 'Pacifico', description: 'Handwritten Script', class: 'font-script', category: 'Elegant' },
  
  // Playful
  { id: 'fredoka', name: 'Fredoka', description: 'Soft & Friendly', class: 'font-playful', category: 'Playful' },
  { id: 'quicksand', name: 'Quicksand', description: 'Rounded Play', class: 'font-quicksand', category: 'Playful' },
  
  // Minimalist
  { id: 'space', name: 'Space', description: 'Technical Mono', class: 'font-mono', category: 'Minimalist' },
  { id: 'grotesk', name: 'Grotesk', description: 'Swiss Minimal', class: 'font-grotesk', category: 'Minimalist' },
  { id: 'syne', name: 'Syne', description: 'Artistic Brutalist', class: 'font-syne', category: 'Minimalist' },
  { id: 'dm', name: 'DM Sans', description: 'Low Contrast', class: 'font-dm', category: 'Minimalist' },
];

export const LAYOUTS = [
  { id: 'classic', name: 'The Classic', description: 'Timeless Typography' },
  { id: 'memory', name: 'The Memory', description: 'Hero Image Focus' },
  { id: 'duo', name: 'The Duo', description: 'Dynamic Storytelling' },
  { id: 'minimalist', name: 'The Minimalist', description: 'Bespoke Elegance' },
  { id: 'full', name: 'Full bleed', description: 'Cinematic Impact' },
];
