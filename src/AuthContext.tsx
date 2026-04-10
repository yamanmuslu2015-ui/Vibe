import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, username: string, displayName: string, photoURL?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateTheme: (theme: string) => Promise<void>;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setProfile(userDoc.data());
          } else {
            const developers = ["yamanmuslu2015@gmail.com", "muslusvetlana1984@gmail.com"];
            const isDeveloper = firebaseUser.email ? developers.includes(firebaseUser.email.toLowerCase()) : false;

            const initialProfile = {
              uid: firebaseUser.uid,
              username: firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.slice(0, 5)}`,
              displayName: firebaseUser.displayName || 'New User',
              photoURL: firebaseUser.photoURL || '',
              bio: '',
              theme: 'white',
              followersCount: 0,
              followingCount: 0,
              likesCount: 0,
              isDeveloper,
              hasBadge: isDeveloper,
              isBanned: false,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, initialProfile);
            setProfile(initialProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email login failed:", error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string, username: string, displayName: string, photoURL?: string) => {
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(newUser, { displayName, photoURL });
      
      const developers = ["yamanmuslu2015@gmail.com", "muslusvetlana1984@gmail.com"];
      const isDeveloper = developers.includes(email.toLowerCase());

      const initialProfile = {
        uid: newUser.uid,
        username: username.toLowerCase(),
        displayName,
        photoURL: photoURL || '',
        bio: '',
        theme: 'white',
        followersCount: 0,
        followingCount: 0,
        likesCount: 0,
        isDeveloper,
        hasBadge: isDeveloper,
        isBanned: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', newUser.uid), initialProfile);
      setProfile(initialProfile);
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateTheme = async (theme: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { theme });
      setProfile((prev: any) => ({ ...prev, theme }));
    } catch (error) {
      console.error("Theme update failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, login, loginWithEmail, registerWithEmail, logout, updateTheme, isAuthReady 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
