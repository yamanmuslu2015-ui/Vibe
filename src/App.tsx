/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  Home, 
  Search, 
  PlusSquare, 
  MessageCircle, 
  User as UserIcon, 
  LogOut,
  Heart,
  MessageSquare,
  Send,
  Image as ImageIcon,
  Camera,
  UserPlus,
  UserCheck,
  Mic,
  Video,
  Play,
  Square,
  Palette,
  Check,
  Clock,
  Settings,
  Bell,
  Type,
  Scissors,
  Layers,
  Trash2,
  Download,
  Phone,
  UserPlus2,
  Users,
  Radio,
  ChevronLeft,
  QrCode,
  Scan
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useState, useEffect, ChangeEvent, FormEvent, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth as firebaseAuth, storage, handleFirestoreError, OperationType } from './firebase';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// --- Utils ---

const playRingtone = () => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const playBeep = (time: number, duration: number) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, time);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.start(time);
    osc.stop(time + duration);
  };

  const now = audioCtx.currentTime;
  const rhythm = [0, 0.4, 0.8, 1.0, 1.4, 1.8, 2.2, 2.4]; // тын тын тынтын тын тын тынтын
  rhythm.forEach(t => playBeep(now + t, 0.2));
};

const uploadFile = async (file: File, path: string): Promise<string> => {
  const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

// --- Components ---

const BannedOverlay = ({ expires }: { expires: string | null }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
        <LogOut className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold mb-4">Account Banned</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Your account has been suspended for violating our community guidelines.
        {expires ? ` Your ban will expire on ${new Date(expires).toLocaleDateString()}.` : " This ban is permanent."}
      </p>
      <Button variant="outline" onClick={() => signOut(firebaseAuth)}>Logout</Button>
    </div>
  );
};

const Navbar = () => {
  const { user, profile, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('toUid', '==', user.uid), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (Notification.permission === 'granted') {
            new Notification(data.fromName || 'SnapVibe', {
              body: data.content,
              icon: '/favicon.ico'
            });
          }
        }
      });
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t md:top-0 md:bottom-auto md:border-b z-50">
      <div className="max-w-screen-md mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tighter hidden md:block">SnapVibe</Link>
        <div className="flex items-center justify-around w-full md:w-auto md:gap-8">
          <Link to="/"><Home className="w-6 h-6" /></Link>
          <Link to="/search"><Search className="w-6 h-6" /></Link>
          <CreatePostDialog />
          <div className="relative">
            <Link to="/notifications">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
          <Link to="/chats"><MessageCircle className="w-6 h-6" /></Link>
          <Link to={`/profile/${user?.uid}`}>
            <Avatar className="w-6 h-6">
              <AvatarImage src={profile?.photoURL} />
              <AvatarFallback>{profile?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </nav>
  );
};

const VideoEditor = ({ 
  src, 
  onSave, 
  onCancel 
}: { 
  src: string, 
  onSave: (data: { blob: Blob, content: string }) => void, 
  onCancel: () => void 
}) => {
  const [textOverlays, setTextOverlays] = useState<{ id: string, text: string, x: number, y: number }[]>([]);
  const [imageOverlays, setImageOverlays] = useState<{ id: string, url: string, x: number, y: number }[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [duration, setDuration] = useState(0);
  const [description, setDescription] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        setDuration(videoRef.current!.duration);
        setEndTime(videoRef.current!.duration);
      };
    }
  }, [src]);

  const addText = () => {
    const text = prompt("Enter text:");
    if (text) {
      setTextOverlays([...textOverlays, { id: Date.now().toString(), text, x: 50, y: 50 }]);
    }
  };

  const addImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageOverlays([...imageOverlays, { id: Date.now().toString(), url, x: 100, y: 100 }]);
    }
  };

  const handleFinish = async () => {
    // In a real app, we'd use a canvas to composite these or ffmpeg.wasm
    // For this demo, we'll simulate the "processed" video by just passing the original blob
    // but we'll include the description.
    const response = await fetch(src);
    const blob = await response.blob();
    onSave({ blob, content: description });
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-square bg-black rounded-lg overflow-hidden group">
        <video 
          ref={videoRef} 
          src={src} 
          className="w-full h-full object-contain" 
          controls 
        />
        
        {/* Overlays Preview (Simplified) */}
        <div className="absolute inset-0 pointer-events-none">
          {textOverlays.map(t => (
            <div 
              key={t.id} 
              className="absolute bg-black/50 text-white px-2 py-1 rounded text-sm font-bold"
              style={{ left: `${t.x}px`, top: `${t.y}px` }}
            >
              {t.text}
            </div>
          ))}
          {imageOverlays.map(img => (
            <img 
              key={img.id} 
              src={img.url} 
              className="absolute w-16 h-16 object-contain"
              style={{ left: `${img.x}px`, top: `${img.y}px` }}
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      </div>

      <div className="flex justify-around p-2 bg-accent/50 rounded-lg">
        <button type="button" onClick={addText} className="flex flex-col items-center gap-1 text-xs font-bold">
          <Type className="w-5 h-5" /> Text
        </button>
        <label className="flex flex-col items-center gap-1 text-xs font-bold cursor-pointer">
          <Layers className="w-5 h-5" /> Image
          <input type="file" accept="image/*" className="hidden" onChange={addImage} />
        </label>
        <div className="flex flex-col items-center gap-1 text-xs font-bold opacity-50">
          <Scissors className="w-5 h-5" /> Trim
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-muted-foreground">Description</label>
        <Textarea 
          placeholder="Add a description for your video..." 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="button" className="flex-1" onClick={handleFinish}>Share Video</Button>
      </div>
    </div>
  );
};

const CreatePostDialog = () => {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMediaType(type);
      if (type === 'video') setIsEditingVideo(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `vid_${Date.now()}.webm`, { type: 'video/webm' });
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(blob));
        setMediaType('video');
        setIsEditingVideo(true);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = () => {
    if (recorder) { 
      recorder.stop(); 
      setIsRecording(false); 
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    }
  };

  const handleSaveEditedVideo = async ({ blob, content: videoDesc }: { blob: Blob, content: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      const url = URL.createObjectURL(blob);
      await addDoc(collection(db, 'posts'), {
        authorUid: user.uid,
        authorUsername: profile?.username,
        authorDisplayName: profile?.displayName,
        authorPhotoURL: profile?.photoURL,
        content: videoDesc,
        mediaUrl: url,
        mediaType: 'video',
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      resetForm();
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setContent('');
    setMediaFile(null);
    setMediaPreview('');
    setMediaType(null);
    setIsEditingVideo(false);
  };

  const handleSubmit = async () => {
    if ((!content.trim() && !mediaFile) || !user) return;
    setLoading(true);
    try {
      let mediaUrl = '';
      if (mediaFile) { 
        mediaUrl = await uploadFile(mediaFile, `posts/${user.uid}`);
      }

      await addDoc(collection(db, 'posts'), {
        authorUid: user.uid,
        authorUsername: profile?.username || user.email?.split('@')[0],
        authorDisplayName: profile?.displayName || user.displayName,
        authorPhotoURL: profile?.photoURL || '',
        isDeveloper: profile?.isDeveloper || false,
        content,
        mediaUrl,
        mediaType,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      resetForm();
      setOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) resetForm(); }}>
      <DialogTrigger asChild>
        <button type="button"><PlusSquare className="w-6 h-6" /></button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditingVideo ? 'Edit Video' : 'Create New Post'}</DialogTitle>
        </DialogHeader>
        
        {isEditingVideo ? (
          <VideoEditor 
            src={mediaPreview} 
            onSave={handleSaveEditedVideo} 
            onCancel={() => setIsEditingVideo(false)} 
          />
        ) : (
          <div className="space-y-4 py-4">
            <Textarea 
              placeholder="What's on your mind?" 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] resize-none border-none focus-visible:ring-0 text-lg"
            />
            
            {isRecording && (
              <div className="relative rounded-lg overflow-hidden aspect-square bg-black">
                <video 
                  ref={videoPreviewRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]" 
                />
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                  <span className="text-white text-xs font-bold shadow-sm">REC</span>
                </div>
              </div>
            )}

            {mediaPreview && !isRecording && (
              <div className="relative rounded-lg overflow-hidden aspect-square bg-muted">
                {mediaType === 'image' ? (
                  <img src={mediaPreview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <video src={mediaPreview} className="w-full h-full object-cover" controls />
                )}
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-2 right-2 rounded-full w-8 h-8"
                  onClick={() => { setMediaFile(null); setMediaPreview(''); setMediaType(null); }}
                >
                  ×
                </Button>
              </div>
            )}

            <div className="flex items-center justify-around gap-4 border-y py-4">
              <label className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <ImageIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">Photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'image')} />
              </label>
              <label className="cursor-pointer flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <Video className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">Video</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileChange(e, 'video')} />
              </label>
              <button 
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex flex-col items-center gap-1 transition-colors ${isRecording ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-primary'}`}
              >
                <Camera className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase">{isRecording ? 'Stop' : 'Record'}</span>
              </button>
            </div>

            <Button 
              type="button"
              className="w-full rounded-full h-12 font-bold text-lg" 
              onClick={handleSubmit} 
              disabled={loading || (!content.trim() && !mediaFile) || isRecording}
            >
              {loading ? 'Posting...' : 'Share Vibe'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const PostCard = ({ post }: { post: any, key?: string }) => {
  const { user, profile } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => {
    if (!user) return;
    const likeRef = doc(db, 'postLikes', post.id, 'userLikes', user.uid);
    const unsubscribe = onSnapshot(likeRef, (doc) => {
      setIsLiked(doc.exists());
    });
    return () => unsubscribe();
  }, [post.id, user]);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [post.id, showComments]);

  const handleLike = async () => {
    if (!user) return;
    const likeRef = doc(db, 'postLikes', post.id, 'userLikes', user.uid);
    const postRef = doc(db, 'posts', post.id);
    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { uid: user.uid, createdAt: serverTimestamp() });
        await updateDoc(postRef, { likesCount: increment(1) });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'postLikes');
    }
  };

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        const file = new File([blob], `record_${Date.now()}.${type === 'video' ? 'webm' : 'webm'}`, { type: blob.type });
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(blob));
        setMediaType(type);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
      setIsRecording(false);
      setRecorder(null);
    }
  };

  const handleAddComment = async () => {
    if ((!newComment.trim() && !mediaFile) || !user) return;
    try {
      let mediaUrl = '';
      if (mediaFile) {
        mediaUrl = await uploadFile(mediaFile, `comments/${post.id}/${user.uid}`);
      }

      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        authorUid: user.uid,
        authorUsername: profile?.username || user.email?.split('@')[0],
        authorDisplayName: profile?.displayName || user.displayName,
        content: newComment,
        mediaUrl,
        mediaType,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });
      setNewComment('');
      setMediaFile(null);
      setMediaPreview('');
      setMediaType(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    }
  };

  const handleDeletePost = async () => {
    if (!user || (user.uid !== post.authorUid && !profile?.isDeveloper)) return;
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'posts');
    }
  };

  return (
    <Card className="mb-6 overflow-hidden border-none shadow-sm md:border md:shadow-none">
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.authorUid}`}>
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.authorPhotoURL} />
              <AvatarFallback>{post.authorDisplayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex flex-col">
            <Link to={`/profile/${post.authorUid}`} className="font-semibold text-sm hover:underline flex items-center gap-1">
              {post.authorUsername || post.authorDisplayName}
              {post.isDeveloper && <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] py-0 px-1 h-4">DEV</Badge>}
            </Link>
            <span className="text-xs text-muted-foreground">
              {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'just now'}
            </span>
          </div>
        </div>
        {(user?.uid === post.authorUid || profile?.isDeveloper) && (
          <Button variant="ghost" size="icon" onClick={handleDeletePost} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pb-3 text-sm whitespace-pre-wrap">{post.content}</div>
        {post.mediaUrl && (
          <div className="bg-black flex items-center justify-center aspect-square">
            {post.mediaType === 'video' ? (
              <video 
                src={post.mediaUrl} 
                className="w-full h-full object-contain" 
                controls 
                loop
                playsInline
              />
            ) : (
              <img 
                src={post.mediaUrl} 
                alt="Post content" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start p-4 gap-3">
        <div className="flex items-center gap-4 w-full">
          <button type="button" onClick={handleLike} className="transition-transform active:scale-125">
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-destructive text-destructive' : ''}`} />
          </button>
          <button type="button" onClick={() => setShowComments(!showComments)}>
            <MessageSquare className="w-6 h-6" />
          </button>
          <Send className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold">
          {post.likesCount || 0} likes
        </div>
        {post.commentsCount > 0 && !showComments && (
          <button 
            type="button"
            onClick={() => setShowComments(true)}
            className="text-sm text-muted-foreground"
          >
            View all {post.commentsCount} comments
          </button>
        )}
        
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full space-y-3 overflow-hidden"
            >
              <Separator />
              <div className="max-h-80 overflow-y-auto space-y-4 pr-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{comment.authorUsername || comment.authorDisplayName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    {comment.content && <div>{comment.content}</div>}
                    {comment.mediaUrl && (
                      <div className="mt-1 rounded-lg overflow-hidden max-w-[200px] border">
                        {comment.mediaType === 'image' && (
                          <img src={comment.mediaUrl} className="w-full h-auto" referrerPolicy="no-referrer" />
                        )}
                        {comment.mediaType === 'video' && (
                          <video src={comment.mediaUrl} controls className="w-full h-auto" />
                        )}
                        {comment.mediaType === 'audio' && (
                          <audio src={comment.mediaUrl} controls className="w-full h-8" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                {mediaPreview && (
                  <div className="relative inline-block rounded-lg overflow-hidden border bg-muted">
                    {mediaType === 'image' && <img src={mediaPreview} className="w-20 h-20 object-cover" />}
                    {mediaType === 'video' && <video src={mediaPreview} className="w-20 h-20 object-cover" />}
                    {mediaType === 'audio' && <div className="p-2 flex items-center gap-2 bg-primary/10"><Mic className="w-4 h-4" /> Audio</div>}
                    <button 
                      type="button"
                      onClick={() => { setMediaFile(null); setMediaPreview(''); setMediaType(null); }}
                      className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                )}
                
                <div className="flex gap-2 items-center">
                  <Input 
                    placeholder="Add a comment..." 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="h-9 text-sm rounded-full"
                  />
                  <div className="flex gap-1">
                    <label className="cursor-pointer p-1.5 hover:bg-accent rounded-full transition-colors">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setMediaFile(file);
                            setMediaPreview(URL.createObjectURL(file));
                            setMediaType('image');
                          }
                        }} 
                      />
                    </label>
                    <button 
                      onClick={() => isRecording ? stopRecording() : startRecording('audio')}
                      className={`p-1.5 hover:bg-accent rounded-full transition-colors ${isRecording && mediaType === 'audio' ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                    >
                      {isRecording && mediaType === 'audio' ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => isRecording ? stopRecording() : startRecording('video')}
                      className={`p-1.5 hover:bg-accent rounded-full transition-colors ${isRecording && mediaType === 'video' ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                    >
                      {isRecording && mediaType === 'video' ? <Square className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleAddComment}
                      disabled={(!newComment.trim() && !mediaFile) || isRecording}
                      className="text-primary font-bold"
                    >
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardFooter>
    </Card>
  );
};

// --- Pages ---

const StoryViewer = ({ 
  stories, 
  onClose 
}: { 
  stories: any[], 
  onClose: () => void 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStory = stories[currentIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentIndex, stories.length, onClose]);

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: i === currentIndex ? '100%' : i < currentIndex ? '100%' : '0%' }}
              transition={{ duration: i === currentIndex ? 5 : 0, ease: 'linear' }}
            />
          </div>
        ))}
      </div>
      
      <div className="p-4 flex items-center justify-between z-10 text-white mt-4">
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8 border border-white">
            <AvatarFallback>{currentStory.authorUsername?.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="font-bold text-sm">@{currentStory.authorUsername}</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
          <LogOut className="w-6 h-6 rotate-90" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {currentStory.mediaType === 'video' ? (
          <video src={currentStory.mediaUrl} autoPlay className="max-h-full w-full object-contain" />
        ) : (
          <img src={currentStory.mediaUrl} className="max-h-full w-full object-contain" referrerPolicy="no-referrer" />
        )}
        
        <div className="absolute inset-y-0 left-0 w-1/3" onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} />
        <div className="absolute inset-y-0 right-0 w-1/3" onClick={() => currentIndex < stories.length - 1 ? setCurrentIndex(currentIndex + 1) : onClose()} />
      </div>
    </div>
  );
};

const NotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('toUid', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Mark as read
      snapshot.docs.forEach(d => {
        if (!d.data().read) {
          updateDoc(doc(db, 'notifications', d.id), { read: true });
        }
      });
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="max-w-screen-sm mx-auto pt-4 md:pt-20 px-4">
      <h2 className="text-2xl font-bold mb-6">Notifications</h2>
      <div className="space-y-4">
        {notifications.map(notif => (
          <Link 
            key={notif.id} 
            to={notif.link || '#'}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-colors hover:bg-accent ${notif.read ? 'opacity-70' : 'bg-accent/30 border-primary/30'}`}
          >
            <div className="p-2 bg-primary/10 rounded-full">
              {notif.type === 'follow' && <UserPlus className="w-5 h-5 text-primary" />}
              {notif.type === 'message' && <MessageSquare className="w-5 h-5 text-primary" />}
              {notif.type === 'group_message' && <Users className="w-5 h-5 text-primary" />}
              {notif.type === 'call' && <Phone className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{notif.fromName}</div>
              <div className="text-sm text-muted-foreground">{notif.content}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {notif.createdAt && formatDistanceToNow(notif.createdAt.toDate())} ago
              </div>
            </div>
          </Link>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No notifications yet.
          </div>
        )}
      </div>
    </div>
  );
};

const FeedPage = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddStory = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    try {
      const mediaUrl = await uploadFile(file, `stories/${user.uid}`);
      
      await addDoc(collection(db, 'stories'), {
        authorUid: user.uid,
        authorUsername: profile?.username,
        mediaUrl,
        mediaType: type,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } catch (error) {
      console.error("Story upload failed:", error);
    }
  };

  if (loading) return <div className="flex justify-center p-12">Loading feed...</div>;

  return (
    <div className="max-w-screen-sm mx-auto pt-4 pb-20 md:pt-20">
      {/* Stories */}
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
        <label className="flex-shrink-0 cursor-pointer">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-accent/50">
            <PlusSquare className="w-6 h-6 text-primary" />
          </div>
          <span className="text-[10px] block text-center mt-1 font-bold">Your Story</span>
          <input type="file" accept="image/*,video/*" className="hidden" onChange={handleAddStory} />
        </label>
        {stories.map((story, index) => (
          <div key={story.id} className="flex-shrink-0 text-center cursor-pointer" onClick={() => setSelectedStoryIndex(index)}>
            <div className="w-16 h-16 rounded-full p-0.5 border-2 border-primary">
              <Avatar className="w-full h-full">
                <AvatarImage src={story.mediaUrl} className="object-cover" />
                <AvatarFallback>{story.authorUsername?.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>
            <span className="text-[10px] block mt-1 truncate w-16">@{story.authorUsername}</span>
          </div>
        ))}
      </div>

      {selectedStoryIndex !== null && (
        <StoryViewer 
          stories={stories.slice(selectedStoryIndex)} 
          onClose={() => setSelectedStoryIndex(null)} 
        />
      )}

      <Separator className="my-4" />

      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      {posts.length === 0 && (
        <div className="text-center p-12 text-muted-foreground">
          No posts yet. Be the first to post!
        </div>
      )}
    </div>
  );
};

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [communityResults, setCommunityResults] = useState<any[]>([]);
  const { user: currentUser } = useAuth();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const lowerQuery = searchQuery.toLowerCase();
    
    const userQ = query(
      collection(db, 'users'), 
      where('username', '>=', lowerQuery),
      where('username', '<=', lowerQuery + '\uf8ff')
    );
    const userSnapshot = await getDocs(userQ);
    setUserResults(userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const communityQ = query(
      collection(db, 'communities'),
      where('name', '>=', searchQuery),
      where('name', '<=', searchQuery + '\uf8ff')
    );
    const communitySnapshot = await getDocs(communityQ);
    setCommunityResults(communitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const sendContactRequest = async (toUid: string) => {
    if (!currentUser) return;
    await addDoc(collection(db, 'contactRequests'), {
      fromUid: currentUser.uid,
      fromUsername: currentUser.displayName,
      toUid,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="max-w-screen-sm mx-auto pt-4 md:pt-20 px-4">
      <div className="flex gap-2 mb-6">
        <Input 
          placeholder="Search users, groups, channels..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="communities">Communities</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {userResults.map(user => (
            <div 
              key={user.id} 
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <Link to={`/profile/${user.id}`} className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={user.photoURL} />
                  <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{user.displayName}</div>
                  <div className="text-sm text-muted-foreground">@{user.username}</div>
                </div>
              </Link>
              {currentUser?.uid !== user.id && (
                <Button size="sm" variant="outline" onClick={() => sendContactRequest(user.id)}>
                  <UserPlus className="w-4 h-4 mr-2" /> Add
                </Button>
              )}
            </div>
          ))}
          {userResults.length === 0 && searchQuery && <div className="text-center py-8 text-muted-foreground">No users found</div>}
        </TabsContent>

        <TabsContent value="communities" className="space-y-4">
          {communityResults.map(comm => (
            <Link 
              key={comm.id} 
              to={`/community/${comm.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors border"
            >
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={comm.photoURL} />
                  <AvatarFallback>{comm.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {comm.name}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {comm.type}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-1">{comm.description}</div>
                </div>
              </div>
              <Button size="sm" variant="ghost">View</Button>
            </Link>
          ))}
          {communityResults.length === 0 && searchQuery && <div className="text-center py-8 text-muted-foreground">No communities found</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, profile: currentUserProfile, logout, updateTheme } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.isBanned) {
      const expires = profile.banExpiresAt ? new Date(profile.banExpiresAt) : null;
      if (expires && expires < new Date()) {
        // Auto unban if expired
        updateDoc(doc(db, 'users', id!), { isBanned: false, banExpiresAt: null });
      }
    }
  }, [profile, id]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName);
      setEditBio(profile.bio || '');
      setEditPhoto(profile.photoURL || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!currentUser || id !== currentUser.uid) return;
    const q = query(collection(db, 'contactRequests'), where('toUid', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [id, currentUser]);

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: editName,
        bio: editBio,
        photoURL: editPhoto
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (action: 'ban' | 'badge' | 'unban' | 'removeBadge') => {
    if (!currentUserProfile?.isDeveloper || !id) return;
    try {
      const updates: any = {};
      if (action === 'ban') {
        const days = prompt('Ban for how many days?', '7');
        if (!days) return;
        updates.isBanned = true;
        updates.banExpiresAt = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
      } else if (action === 'unban') {
        updates.isBanned = false;
        updates.banExpiresAt = null;
      } else if (action === 'badge') {
        updates.hasBadge = true;
      } else if (action === 'removeBadge') {
        updates.hasBadge = false;
      }
      await updateDoc(doc(db, 'users', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    await updateDoc(doc(db, 'contactRequests', requestId), { status });
  };

  const themes = [
    { name: 'white', color: 'bg-white', primary: '#ffffff', isDark: false },
    { name: 'purple', color: 'bg-purple-500', primary: '#a855f7', isDark: false },
    { name: 'orange', color: 'bg-orange-500', primary: '#f97316', isDark: false },
    { name: 'red', color: 'bg-red-500', primary: '#ef4444', isDark: false },
    { name: 'gray', color: 'bg-gray-500', primary: '#6b7280', isDark: false },
    { name: 'black', color: 'bg-black', primary: '#000000', isDark: true },
  ];

  const handleScanSuccess = async (decodedText: string) => {
    if (!currentUser) return;
    try {
      let data;
      try {
        data = JSON.parse(decodedText);
      } catch (e) {
        // If not JSON, maybe it's just a UID or username
        data = { type: 'user', uid: decodedText };
      }

      if (data.type === 'user' && data.uid && data.uid !== currentUser.uid) {
        const targetUid = data.uid;
        
        // Follow logic
        const followerRef = doc(db, 'followers', targetUid, 'userFollowers', currentUser.uid);
        const followingRef = doc(db, 'following', currentUser.uid, 'userFollowing', targetUid);
        const targetUserRef = doc(db, 'users', targetUid);
        const currentUserRef = doc(db, 'users', currentUser.uid);

        await setDoc(followerRef, { uid: currentUser.uid, createdAt: serverTimestamp() });
        await setDoc(followingRef, { uid: targetUid, createdAt: serverTimestamp() });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        await updateDoc(currentUserRef, { followingCount: increment(1) });

        // Start chat
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        const existingChat = snapshot.docs.find(doc => doc.data().participants.includes(targetUid));

        if (!existingChat) {
          await addDoc(collection(db, 'chats'), {
            participants: [currentUser.uid, targetUid],
            lastMessage: 'Added via QR Code',
            lastMessageAt: serverTimestamp(),
          });
        }
        
        alert('Contact added successfully!');
        // window.location.reload(); // Removed to prevent unexpected redirects
      }
    } catch (err) {
      console.error('QR Scan error:', err);
      alert('Failed to scan QR code. Please try again.');
    }
  };

  const startScanner = () => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render(handleScanSuccess, (err) => console.warn(err));
  };

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'users', id), (doc) => {
      setProfile(doc.data());
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'posts'), where('authorUid', '==', id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id || !currentUser) return;
    const followRef = doc(db, 'followers', id, 'userFollowers', currentUser.uid);
    const unsubscribe = onSnapshot(followRef, (doc) => {
      setIsFollowing(doc.exists());
    });
    return () => unsubscribe();
  }, [id, currentUser]);

  const handleDeleteContact = async () => {
    if (!id || !currentUser || !isFollowing) return;
    if (!confirm('Are you sure you want to remove this contact?')) return;
    
    const followerRef = doc(db, 'followers', id, 'userFollowers', currentUser.uid);
    const followingRef = doc(db, 'following', currentUser.uid, 'userFollowing', id);
    const targetUserRef = doc(db, 'users', id);
    const currentUserRef = doc(db, 'users', currentUser.uid);

    try {
      await deleteDoc(followerRef);
      await deleteDoc(followingRef);
      await updateDoc(targetUserRef, { followersCount: increment(-1) });
      await updateDoc(currentUserRef, { followingCount: increment(-1) });
      alert('Contact removed.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'followers');
    }
  };
  const handleFollow = async () => {
    if (!id || !currentUser) return;
    const followerRef = doc(db, 'followers', id, 'userFollowers', currentUser.uid);
    const followingRef = doc(db, 'following', currentUser.uid, 'userFollowing', id);
    const targetUserRef = doc(db, 'users', id);
    const currentUserRef = doc(db, 'users', currentUser.uid);

    try {
      if (isFollowing) {
        await deleteDoc(followerRef);
        await deleteDoc(followingRef);
        await updateDoc(targetUserRef, { followersCount: increment(-1) });
        await updateDoc(currentUserRef, { followingCount: increment(-1) });
      } else {
        await setDoc(followerRef, { uid: currentUser.uid, createdAt: serverTimestamp() });
        await setDoc(followingRef, { uid: id, createdAt: serverTimestamp() });
        await updateDoc(targetUserRef, { followersCount: increment(1) });
        await updateDoc(currentUserRef, { followingCount: increment(1) });
        
        // Notification
        await addDoc(collection(db, 'notifications'), {
          toUid: id,
          fromUid: currentUser.uid,
          fromName: currentUserProfile?.displayName || 'Someone',
          type: 'follow',
          content: 'started following you!',
          link: `/profile/${currentUser.uid}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'followers');
    }
  };

  const startChat = async () => {
    if (!currentUser || !id || currentUser.uid === id) return;
    
    // Check if chat already exists
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', currentUser.uid)
    );
    const snapshot = await getDocs(q);
    const existingChat = snapshot.docs.find(doc => doc.data().participants.includes(id));

    if (existingChat) {
      navigate(`/chat/${existingChat.id}`);
    } else {
      const newChat = await addDoc(collection(db, 'chats'), {
        participants: [currentUser.uid, id],
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
      });
      navigate(`/chat/${newChat.id}`);
    }
  };

  if (!profile) return <div className="p-12 text-center">Loading profile...</div>;

  return (
    <div className="max-w-screen-md mx-auto pt-4 md:pt-20 px-4 pb-20">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
        <Avatar className="w-24 h-24 md:w-32 md:h-32 ring-4 ring-primary/10">
          <AvatarImage src={profile.photoURL} />
          <AvatarFallback className="text-2xl">{profile.displayName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h2 className="text-2xl font-bold">@{profile.username}</h2>
              {profile.hasBadge && <Badge variant="secondary" className="bg-primary/10 text-primary border-none">DEV</Badge>}
            </div>
            <div className="flex gap-2 justify-center">
              {currentUser?.uid !== id ? (
                <>
                  <Button onClick={handleFollow} variant={isFollowing ? "outline" : "default"} className="rounded-full px-6">
                    {isFollowing ? <><UserCheck className="w-4 h-4 mr-2" /> Following</> : <><UserPlus className="w-4 h-4 mr-2" /> Follow</>}
                  </Button>
                  <Button variant="secondary" onClick={startChat} className="rounded-full px-6">
                    Message
                  </Button>
                  {isFollowing && (
                    <Button variant="ghost" size="icon" onClick={handleDeleteContact} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {currentUserProfile?.isDeveloper && (
                    <div className="flex gap-2">
                      <Button variant="destructive" size="sm" onClick={() => handleAdminAction(profile.isBanned ? 'unban' : 'ban')}>
                        {profile.isBanned ? 'Unban' : 'Ban'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAdminAction(profile.hasBadge ? 'removeBadge' : 'badge')}>
                        {profile.hasBadge ? 'Remove Badge' : 'Give Badge'}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setIsEditing(true)}><Settings className="w-4 h-4 mr-2" /> Edit</Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="rounded-full"><Palette className="w-4 h-4 mr-2" /> Theme</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Choose Profile Theme</DialogTitle></DialogHeader>
                      <div className="grid grid-cols-3 gap-4 py-4">
                        {themes.map(t => (
                          <button 
                            key={t.name}
                            onClick={() => updateTheme(t.name)}
                            className={`h-12 rounded-lg border-2 flex items-center justify-center ${t.color} ${profile.theme === t.name ? 'border-primary' : 'border-transparent'}`}
                          >
                            {profile.theme === t.name && <Check className="w-6 h-6 text-white mix-blend-difference" />}
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="rounded-full"><QrCode className="w-4 h-4 mr-2" /> QR Code</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader><DialogTitle>Your QR Code</DialogTitle></DialogHeader>
                      <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        <div className="bg-white p-4 rounded-xl shadow-lg">
                          <QRCodeSVG 
                            value={JSON.stringify({ type: 'user', uid: currentUser.uid, username: profile.username })}
                            size={200}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                          Others can scan this to add you to their contacts instantly.
                        </p>
                        <Separator />
                        <Button className="w-full" onClick={startScanner}>
                          <Scan className="w-4 h-4 mr-2" /> Scan QR Code
                        </Button>
                        <div id="reader" className="w-full"></div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" onClick={() => logout()} className="rounded-full">Logout</Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-center md:justify-start gap-8 text-sm">
            <div><span className="font-bold">{posts.length}</span> posts</div>
            <div><span className="font-bold">{profile.followersCount || 0}</span> followers</div>
            <div><span className="font-bold">{profile.followingCount || 0}</span> following</div>
          </div>
          <div>
            <div className="font-bold">{profile.displayName}</div>
            <div className="text-sm whitespace-pre-wrap">{profile.bio}</div>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">ID: {id}</Badge>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="grid grid-cols-3 gap-1 md:gap-4">
        {posts.map(post => (
          <Link key={post.id} to={`/post/${post.id}`} className="aspect-square relative group">
            {post.mediaUrl ? (
              post.mediaType === 'video' ? (
                <div className="w-full h-full bg-black flex items-center justify-center rounded-sm overflow-hidden">
                  <Play className="w-8 h-8 text-white/50" />
                </div>
              ) : (
                <img 
                  src={post.mediaUrl} 
                  className="w-full h-full object-cover rounded-sm" 
                  referrerPolicy="no-referrer"
                />
              )
            ) : (
              <div className="w-full h-full bg-accent flex items-center justify-center p-2 text-[10px] md:text-xs overflow-hidden text-center rounded-sm">
                {post.content}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-bold">
              <div className="flex items-center gap-1"><Heart className="w-4 h-4 fill-white" /> {post.likesCount}</div>
              <div className="flex items-center gap-1"><MessageSquare className="w-4 h-4 fill-white" /> {post.commentsCount}</div>
            </div>
          </Link>
        ))}
      </div>

      {currentUser?.uid === id && requests.length > 0 && (
        <div className="mt-12 space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2"><Bell className="w-5 h-5" /> Contact Requests</h3>
          <div className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-4 bg-accent/30 rounded-xl border">
                <div className="font-medium">Request from @{req.fromUsername}</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRequest(req.id, 'accepted')}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRequest(req.id, 'rejected')}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Display Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Bio</label>
              <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase">Avatar</label>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={editPhoto} />
                  <AvatarFallback>{editName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <label className="cursor-pointer bg-accent px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent/80 transition-colors">
                  Choose from Gallery
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && currentUser) {
                        setLoading(true);
                        try {
                          const url = await uploadFile(file, `avatars/${currentUser.uid}`);
                          setEditPhoto(url);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }} 
                  />
                </label>
              </div>
            </div>
            <Button className="w-full" onClick={handleUpdateProfile} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CreateCommunityDialog = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'group' | 'channel'>('group');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'communities'), {
        name,
        description,
        type,
        ownerUid: user.uid,
        admins: [user.uid],
        members: [user.uid],
        photoURL: '',
        createdAt: serverTimestamp()
      });
      setOpen(false);
      navigate(`/community/${docRef.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <PlusSquare className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Community</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this about?" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase">Type</label>
            <Tabs value={type} onValueChange={(v: any) => setType(v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="group">Group</TabsTrigger>
                <TabsTrigger value="channel">Channel</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ChatsPage = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('lastMessageAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'communities'), where('members', 'array-contains', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddContact = async () => {
    if (!searchUsername.trim() || !user) return;
    try {
      const q = query(collection(db, 'users'), where('username', '==', searchUsername.toLowerCase()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert('User not found');
        return;
      }
      const targetUser = snapshot.docs[0].data();
      if (targetUser.uid === user.uid) {
        alert('You cannot add yourself');
        return;
      }

      // Check if chat already exists
      const chatQ = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const chatSnapshot = await getDocs(chatQ);
      const existingChat = chatSnapshot.docs.find(doc => doc.data().participants.includes(targetUser.uid));

      if (existingChat) {
        navigate(`/chat/${existingChat.id}`);
      } else {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [user.uid, targetUser.uid],
          lastMessage: '',
          lastMessageAt: serverTimestamp(),
        });
        navigate(`/chat/${newChat.id}`);
      }
      setIsAdding(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-screen-sm mx-auto pt-4 md:pt-20 px-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Messages</h2>
        <div className="flex gap-2">
          <CreateCommunityDialog />
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" className="rounded-full">
                <UserPlus2 className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input 
                  placeholder="Enter username..." 
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                />
                <Button className="w-full" onClick={handleAddContact}>Start Chat</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="chats">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="communities">Communities</TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="space-y-2">
          {chats.map(chat => (
            <Link 
              key={chat.id} 
              to={`/chat/${chat.id}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent transition-colors border"
            >
              <Avatar className="w-12 h-12">
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="font-semibold">Chat</div>
                <div className="text-sm text-muted-foreground truncate">{chat.lastMessage || 'No messages yet'}</div>
              </div>
            </Link>
          ))}
          {chats.length === 0 && (
            <div className="text-center p-12 text-muted-foreground">
              No active chats. Add a contact to start messaging!
            </div>
          )}
        </TabsContent>

        <TabsContent value="communities" className="space-y-2">
          {communities.map(comm => (
            <Link 
              key={comm.id} 
              to={`/community/${comm.id}`}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent transition-colors border"
            >
              <Avatar className="w-12 h-12">
                <AvatarImage src={comm.photoURL} />
                <AvatarFallback>{comm.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="font-semibold flex items-center gap-2">
                  {comm.name}
                  <Badge variant="outline" className="text-[10px] uppercase">{comm.type}</Badge>
                </div>
                <div className="text-sm text-muted-foreground truncate">{comm.description || 'No description'}</div>
              </div>
            </Link>
          ))}
          {communities.length === 0 && (
            <div className="text-center p-12 text-muted-foreground">
              You haven't joined any communities yet.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LoginPage = () => {
  const { login, loginWithEmail, registerWithEmail } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await registerWithEmail(email, password, username, displayName, avatarUrl);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gradient-to-b from-background to-accent/20">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="space-y-8 max-w-sm w-full"
      >
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tighter italic">SnapVibe</h1>
          <p className="text-muted-foreground">Share your world, one vibe at a time.</p>
        </div>
        
        <Card className="p-6 shadow-xl border-none text-left">
          <Tabs value={isRegister ? 'register' : 'login'} onValueChange={(v) => setIsRegister(v === 'register')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Username</label>
                    <Input placeholder="cool_user" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Display Name</label>
                    <Input placeholder="John Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Avatar URL</label>
                    <Input placeholder="https://..." value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Email</label>
                <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Password</label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
              
              <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
                {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
              </Button>
            </form>
          </Tabs>

          <Separator className="my-6" />
          
          <Button variant="outline" onClick={login} className="w-full h-12 font-bold">
            Continue with Google
          </Button>
        </Card>
      </motion.div>
    </div>
  );
};

const ChatRoomPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'chats', id), (doc) => {
      setChat(doc.data());
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!chat || !user) return;
    const otherId = chat.participants.find((p: string) => p !== user.uid);
    if (otherId) {
      getDoc(doc(db, 'users', otherId)).then(doc => setOtherUser(doc.data()));
    }
  }, [chat, user]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'chats', id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id || !user || !chat) return;
    const typingRef = doc(db, 'chats', id, 'typing', user.uid);
    setDoc(typingRef, { isTyping, updatedAt: serverTimestamp() });
    
    const otherId = chat.participants.find((p: string) => p !== user.uid);
    if (otherId) {
      const otherTypingRef = doc(db, 'chats', id, 'typing', otherId);
      const unsub = onSnapshot(otherTypingRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const updatedAt = data.updatedAt?.toDate();
          const isRecentlyUpdated = updatedAt && updatedAt > new Date(Date.now() - 5000);
          setOtherUserTyping(data.isTyping && isRecentlyUpdated);
        }
      });
      return () => unsub();
    }
  }, [isTyping, id, user, chat]);

  const handleTyping = (e: ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 3000);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user || !id) return;
    const msgRef = doc(db, 'chats', id, 'messages', messageId);
    await updateDoc(msgRef, {
      [`reactions.${user.uid}`]: emoji
    });
  };

  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, 'calls'), 
      where('chatId', '==', id), 
      where('toUid', '==', user.uid), 
      where('status', '==', 'ringing')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setIncomingCall({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        playRingtone(); // Play custom ringtone
      } else {
        setIncomingCall(null);
      }
    });
    return () => unsubscribe();
  }, [user, id]);

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        const file = new File([blob], `chat_record_${Date.now()}.${type === 'video' ? 'webm' : 'webm'}`, { type: blob.type });
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(blob));
        setMediaType(type);
        
        // Stop all tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
      setIsRecording(false);
      setRecorder(null);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !mediaFile) || !user || !id) return;
    const messageContent = newMessage;
    const currentMediaFile = mediaFile;
    const currentMediaType = mediaType;
    
    // Clear state immediately to prevent double sends and show progress
    setNewMessage('');
    setMediaFile(null);
    setMediaPreview('');
    setMediaType(null);
    setIsTyping(false);

    try {
      let mediaUrl = '';
      if (currentMediaFile) {
        mediaUrl = await uploadFile(currentMediaFile, `chats/${id}/${user.uid}`);
      }

      await addDoc(collection(db, 'chats', id, 'messages'), {
        chatId: id,
        senderUid: user.uid,
        content: messageContent,
        mediaUrl,
        mediaType: currentMediaType,
        reactions: {},
        createdAt: serverTimestamp(),
      });
      
      await updateDoc(doc(db, 'chats', id), {
        lastMessage: mediaUrl ? `Sent a ${currentMediaType}` : messageContent,
        lastMessageAt: serverTimestamp(),
      });

      // Notification
      if (otherUser) {
        await addDoc(collection(db, 'notifications'), {
          toUid: otherUser.uid,
          fromUid: user.uid,
          fromName: profile?.displayName || 'Someone',
          type: 'message',
          content: mediaUrl ? `Sent a ${currentMediaType}` : messageContent,
          link: `/chat/${id}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }
  };

  const handleCall = async (type: 'audio' | 'video') => {
    if (!user || !otherUser || !id) return;
    setIsCalling(true);
    setCallType(type);
    await addDoc(collection(db, 'calls'), {
      chatId: id,
      fromUid: user.uid,
      toUid: otherUser.uid,
      type,
      status: 'ringing',
      createdAt: serverTimestamp()
    });

    // Notification for call
    await addDoc(collection(db, 'notifications'), {
      toUid: otherUser.uid,
      fromUid: user.uid,
      fromName: profile?.displayName || 'Someone',
      type: 'call',
      content: `Incoming ${type} call...`,
      link: `/chat/${id}`,
      read: false,
      createdAt: serverTimestamp()
    });
  };

  const endCall = async () => {
    setIsCalling(false);
    setCallType(null);
    // In a real app, we'd update the call doc status to 'ended'
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'accepted' });
    setCallType(incomingCall.type);
    setIsCalling(true);
    setIncomingCall(null);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'rejected' });
    setIncomingCall(null);
  };

  return (
    <div className="max-w-screen-sm mx-auto h-[calc(100vh-64px)] md:pt-20 flex flex-col relative">
      {/* Call UI Overlay */}
      {(isCalling || incomingCall) && (
        <div className="fixed inset-0 z-[150] bg-black/90 flex flex-col items-center justify-center text-white p-8">
          <Avatar className="w-32 h-32 mb-6 ring-4 ring-primary">
            <AvatarImage src={otherUser?.photoURL} />
            <AvatarFallback className="text-4xl">{otherUser?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold mb-2">{otherUser?.displayName}</h2>
          <p className="text-muted-foreground mb-12">
            {incomingCall ? `Incoming ${incomingCall.type} call...` : `Calling (${callType})...`}
          </p>
          
          <div className="flex gap-8">
            {incomingCall ? (
              <>
                <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={rejectCall}>
                  <LogOut className="w-8 h-8 rotate-90" />
                </Button>
                <Button variant="default" size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600" onClick={acceptCall}>
                  {incomingCall.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                </Button>
              </>
            ) : (
              <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={endCall}>
                <LogOut className="w-8 h-8 rotate-90" />
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="p-4 border-b flex items-center justify-between bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/chats')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={otherUser?.photoURL} />
            <AvatarFallback>{otherUser?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-bold">{otherUser?.displayName || 'Chat'}</div>
          {otherUserTyping && <div className="text-[10px] text-primary animate-pulse">typing...</div>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleCall('audio')}>
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleCall('video')}>
            <Video className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`flex ${msg.senderUid === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
                <div className={`p-3 rounded-2xl relative group ${
                  msg.senderUid === user?.uid 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-accent rounded-tl-none'
                }`}>
                  {msg.content && <div>{msg.content}</div>}
                  {msg.mediaUrl && (
                    <div className="mt-2">
                      {msg.mediaType === 'video' ? (
                        <video src={msg.mediaUrl} controls className="max-w-full rounded-lg" />
                      ) : msg.mediaType === 'audio' ? (
                        <audio src={msg.mediaUrl} controls className="max-w-full" />
                      ) : (
                        <img src={msg.mediaUrl} className="max-w-full rounded-lg" referrerPolicy="no-referrer" />
                      )}
                    </div>
                  )}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`absolute -bottom-2 flex -space-x-1 ${msg.senderUid === user?.uid ? 'right-0' : 'left-0'}`}>
                      {Object.entries(msg.reactions).map(([uid, emoji]: [string, any]) => (
                        <div key={uid} className="bg-background border rounded-full px-1 text-[10px] shadow-sm">
                          {emoji}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`absolute top-0 hidden group-hover:flex gap-1 bg-background border rounded-full p-1 shadow-sm ${msg.senderUid === user?.uid ? 'right-full mr-2' : 'left-full ml-2'}`}>
                    {['❤️', '👍', '🔥', '😂'].map(emoji => (
                      <button type="button" key={emoji} onClick={() => addReaction(msg.id, emoji)} className="hover:scale-125 transition-transform">
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {msg.senderUid === user?.uid && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteDoc(doc(db, 'chats', id!, 'messages', msg.id))}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background">
        {isRecording && (
          <div className="mb-4 p-4 bg-destructive/10 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-bold text-destructive">
                Recording {mediaType === 'audio' ? 'Voice' : 'Video'}...
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive font-bold" onClick={stopRecording}>
              Stop
            </Button>
          </div>
        )}
        {mediaPreview && !isRecording && (
          <div className="mb-4 p-2 bg-accent rounded-lg relative">
            {mediaType === 'video' ? (
              <video src={mediaPreview} controls className="h-32 rounded" />
            ) : (
              <audio src={mediaPreview} controls className="w-full" />
            )}
            <Button 
              variant="destructive" 
              size="icon" 
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
              onClick={() => { setMediaFile(null); setMediaPreview(''); setMediaType(null); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              className="absolute bottom-2 right-2 rounded-full"
              onClick={sendMessage}
            >
              <Send className="w-4 h-4 mr-2" /> Send
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`rounded-full ${isRecording && mediaType === 'audio' ? 'text-destructive animate-pulse' : ''}`}
              onClick={() => isRecording ? stopRecording() : startRecording('audio')}
            >
              <Mic className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`rounded-full ${isRecording && mediaType === 'video' ? 'text-destructive animate-pulse' : ''}`}
              onClick={() => isRecording ? stopRecording() : startRecording('video')}
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
          <Input 
            placeholder="Type a message..." 
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="rounded-full flex-1"
          />
          <Button size="icon" className="rounded-full" onClick={sendMessage} disabled={isRecording}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

import { useParams, useNavigate } from 'react-router-dom';

const CommunityPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [community, setCommunity] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, 'calls'), 
      where('communityId', '==', id), 
      where('status', '==', 'ringing')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callData = snapshot.docs[0].data();
        if (callData.fromUid !== user.uid) {
          setIncomingCall({ id: snapshot.docs[0].id, ...callData });
          playRingtone();
        }
      } else {
        setIncomingCall(null);
      }
    });
    return () => unsubscribe();
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'communities', id), (doc) => {
      const data = doc.data();
      setCommunity({ id: doc.id, ...data });
      if (user && data?.members?.includes(user.uid)) {
        setIsMember(true);
      } else {
        setIsMember(false);
      }
    });
    return () => unsubscribe();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'communities', id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [id]);

  const handleJoin = async () => {
    if (!user || !id) return;
    try {
      await updateDoc(doc(db, 'communities', id), {
        members: arrayUnion(user.uid)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !mediaFile) || !user || !id) return;
    const isAdmin = community.admins.includes(user.uid) || community.ownerUid === user.uid;
    if (community.type === 'channel' && !isAdmin) return;

    const messageContent = newMessage;
    const currentMediaFile = mediaFile;
    const currentMediaType = mediaType;

    // Clear state immediately
    setNewMessage('');
    setMediaFile(null);
    setMediaPreview('');
    setMediaType(null);

    try {
      let mediaUrl = '';
      if (currentMediaFile) {
        mediaUrl = await uploadFile(currentMediaFile, `communities/${id}/${user.uid}`);
      }

      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const profileData = profileDoc.data();

      await addDoc(collection(db, 'communities', id, 'messages'), {
        senderUid: user.uid,
        senderName: profileData?.displayName || 'User',
        senderPhoto: profileData?.photoURL || '',
        content: messageContent,
        mediaUrl,
        mediaType: currentMediaType,
        createdAt: serverTimestamp(),
      });

      // Notify members (limited to first few for performance/quota)
      const notifyMembers = community.members.filter((m: string) => m !== user.uid).slice(0, 10);
      for (const memberUid of notifyMembers) {
        await addDoc(collection(db, 'notifications'), {
          toUid: memberUid,
          fromUid: user.uid,
          fromName: community.name,
          type: 'group_message',
          content: mediaUrl ? `Sent a ${currentMediaType}` : messageContent,
          link: `/community/${id}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }
  };

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        const file = new File([blob], `comm_record_${Date.now()}.${type === 'video' ? 'webm' : 'webm'}`, { type: blob.type });
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(blob));
        setMediaType(type);
        
        // Stop all tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording failed:", err);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
      setIsRecording(false);
      setRecorder(null);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    if (!id || !user) return;
    if (memberUid === community.ownerUid) return; // Cannot remove owner
    try {
      await updateDoc(doc(db, 'communities', id), {
        members: arrayRemove(memberUid),
        admins: arrayRemove(memberUid)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCommunity = async () => {
    if (!id || !user || user.uid !== community.ownerUid) return;
    if (!confirm('Are you sure you want to delete this community? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'communities', id));
      navigate('/chats');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGroupCall = async (type: 'audio' | 'video') => {
    if (!user || !id || !community) return;
    try {
      const callRef = await addDoc(collection(db, 'calls'), {
        communityId: id,
        communityName: community.name,
        fromUid: user.uid,
        fromName: user.displayName,
        type,
        status: 'ringing',
        createdAt: serverTimestamp(),
        participants: community.members
      });

      // Notify members
      const notifyMembers = community.members.filter((m: string) => m !== user.uid).slice(0, 10);
      for (const memberUid of notifyMembers) {
        await addDoc(collection(db, 'notifications'), {
          toUid: memberUid,
          fromUid: user.uid,
          fromName: community.name,
          type: 'call',
          content: `Incoming group ${type} call...`,
          link: `/community/${id}?call=${callRef.id}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
      playRingtone();
    } catch (err) {
      console.error(err);
    }
  };

  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const handleSearchUser = async () => {
    if (!searchUser.trim()) return;
    const q = query(
      collection(db, 'users'),
      where('username', '>=', searchUser.toLowerCase()),
      where('username', '<=', searchUser.toLowerCase() + '\uf8ff')
    );
    const snapshot = await getDocs(q);
    setSearchResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAddMember = async (targetUid: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'communities', id), {
        members: arrayUnion(targetUid)
      });
      setSearchUser('');
      setSearchResults([]);
    } catch (err) {
      console.error(err);
    }
  };

  const canSend = community?.type === 'group' || (community?.admins?.includes(user?.uid) || community?.ownerUid === user?.uid);
  const isOwner = user?.uid === community?.ownerUid;
  const isAdmin = community?.admins?.includes(user?.uid) || isOwner;

  return (
    <div className="max-w-screen-sm mx-auto h-[calc(100vh-64px)] md:pt-20 flex flex-col relative">
      {/* Call UI Overlay */}
      {(isCalling || incomingCall) && (
        <div className="fixed inset-0 z-[150] bg-black/90 flex flex-col items-center justify-center text-white p-8 text-center">
          <Avatar className="w-32 h-32 mb-6 ring-4 ring-primary">
            <AvatarImage src={community?.photoURL} />
            <AvatarFallback className="text-4xl">{community?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold mb-2">{community?.name}</h2>
          <p className="text-muted-foreground mb-12">
            {incomingCall ? `Incoming group ${incomingCall.type} call...` : `Calling group (${callType})...`}
          </p>
          
          <div className="flex gap-8">
            {incomingCall ? (
              <>
                <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={() => setIncomingCall(null)}>
                  <LogOut className="w-8 h-8 rotate-90" />
                </Button>
                <Button variant="default" size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600" onClick={() => { setIsCalling(true); setCallType(incomingCall.type); setIncomingCall(null); }}>
                  {incomingCall.type === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                </Button>
              </>
            ) : (
              <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={() => { setIsCalling(false); setCallType(null); }}>
                <LogOut className="w-8 h-8 rotate-90" />
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="p-4 border-b flex items-center justify-between bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/chats')}>
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage src={community?.photoURL} />
                <AvatarFallback>{community?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{community?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <Avatar className="w-24 h-24 mx-auto mb-2">
                    <AvatarImage src={community?.photoURL} />
                    <AvatarFallback className="text-4xl">{community?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="text-muted-foreground">{community?.description || 'No description'}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Members ({community?.members?.length})</h3>
                    {isAdmin && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline"><UserPlus className="w-4 h-4 mr-2" /> Add</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="flex gap-2">
                              <Input 
                                placeholder="Search username..." 
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                              />
                              <Button onClick={handleSearchUser}>Search</Button>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                              {searchResults.map(u => (
                                <div key={u.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-8 h-8"><AvatarImage src={u.photoURL} /></Avatar>
                                    <div className="text-sm font-medium">{u.displayName}</div>
                                  </div>
                                  <Button size="sm" onClick={() => handleAddMember(u.id)}>Add</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  <ScrollArea className="h-48 border rounded-lg p-2">
                    <div className="space-y-2">
                      {community?.members?.map((mUid: string) => (
                        <div key={mUid} className="flex items-center justify-between group">
                          <Link to={`/profile/${mUid}`} className="flex items-center gap-2">
                            <div className="text-sm">User {mUid.slice(0, 8)}...</div>
                            {mUid === community.ownerUid && <Badge variant="secondary" className="text-[10px]">Owner</Badge>}
                          </Link>
                          {isAdmin && mUid !== community.ownerUid && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveMember(mUid)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {isOwner && (
                  <Button variant="destructive" className="w-full" onClick={handleDeleteCommunity}>
                    Delete Community
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <div>
            <div className="font-bold flex items-center gap-2">
              {community?.name}
              <Badge variant="outline" className="text-[10px] uppercase">{community?.type}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{community?.members?.length || 0} members</div>
          </div>
        </div>
        <div className="flex gap-2">
          {isMember && community?.type === 'group' && (
            <>
              <Button variant="ghost" size="icon" onClick={() => handleGroupCall('audio')}>
                <Phone className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleGroupCall('video')}>
                <Video className="w-5 h-5" />
              </Button>
            </>
          )}
          {!isMember && (
            <Button size="sm" onClick={handleJoin}>Join</Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`flex ${msg.senderUid === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[80%] ${msg.senderUid === user?.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar className="w-8 h-8 mt-1 shrink-0">
                  <AvatarImage src={msg.senderPhoto} />
                  <AvatarFallback>{msg.senderName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={`p-3 rounded-2xl relative group ${
                  msg.senderUid === user?.uid 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-accent rounded-tl-none'
                }`}>
                  <div className="text-[10px] font-bold mb-1 opacity-80">{msg.senderName}</div>
                  {msg.content && <div>{msg.content}</div>}
                  {msg.mediaUrl && (
                    <div className="mt-2">
                      {msg.mediaType === 'video' ? (
                        <video src={msg.mediaUrl} controls className="max-w-full rounded-lg" />
                      ) : msg.mediaType === 'audio' ? (
                        <audio src={msg.mediaUrl} controls className="max-w-full" />
                      ) : (
                        <img src={msg.mediaUrl} className="max-w-full rounded-lg" referrerPolicy="no-referrer" />
                      )}
                    </div>
                  )}
                  {msg.senderUid === user?.uid && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteDoc(doc(db, 'communities', id!, 'messages', msg.id))}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {isMember && (
        <div className="p-4 border-t bg-background">
          {isRecording && (
            <div className="mb-4 p-4 bg-destructive/10 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-bold text-destructive">
                  Recording {mediaType === 'audio' ? 'Voice' : 'Video'}...
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive font-bold" onClick={stopRecording}>
                Stop
              </Button>
            </div>
          )}
          {mediaPreview && !isRecording && (
            <div className="mb-4 p-2 bg-accent rounded-lg relative">
              {mediaType === 'video' ? (
                <video src={mediaPreview} controls className="h-32 rounded" />
              ) : (
                <audio src={mediaPreview} controls className="w-full" />
              )}
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                onClick={() => { setMediaFile(null); setMediaPreview(''); setMediaType(null); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              <Button 
                size="sm" 
                className="absolute bottom-2 right-2 rounded-full"
                onClick={sendMessage}
              >
                <Send className="w-4 h-4 mr-2" /> Send
              </Button>
            </div>
          )}
          {canSend ? (
            <div className="flex gap-2 items-center">
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`rounded-full ${isRecording && mediaType === 'audio' ? 'text-destructive animate-pulse' : ''}`}
                  onClick={() => isRecording ? stopRecording() : startRecording('audio')}
                >
                  <Mic className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`rounded-full ${isRecording && mediaType === 'video' ? 'text-destructive animate-pulse' : ''}`}
                  onClick={() => isRecording ? stopRecording() : startRecording('video')}
                >
                  <Camera className="w-5 h-5" />
                </Button>
              </div>
              <Input 
                placeholder={community?.type === 'channel' ? "Broadcast a message..." : "Type a message..."} 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                className="rounded-full flex-1"
              />
              <Button type="button" size="icon" className="rounded-full" onClick={sendMessage} disabled={isRecording}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              Only admins can send messages in this channel.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AppContent = () => {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (profile?.theme) {
      const themesMap: Record<string, { primary: string, isDark: boolean }> = {
        purple: { primary: '#a855f7', isDark: false },
        orange: { primary: '#f97316', isDark: false },
        red: { primary: '#ef4444', isDark: false },
        gray: { primary: '#6b7280', isDark: false },
        black: { primary: '#000000', isDark: true },
        white: { primary: '#ffffff', isDark: false }
      };
      
      const themeConfig = themesMap[profile.theme] || themesMap.purple;
      document.documentElement.style.setProperty('--primary', themeConfig.primary);
      
      if (themeConfig.isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [profile?.theme]);

  useEffect(() => {
    if (user && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (user && profile?.isBanned) {
    return <BannedOverlay expires={profile.banExpiresAt} />;
  }

  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0 md:pt-0">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chat/:id" element={<ChatRoomPage />} />
          <Route path="/community/:id" element={<CommunityPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
