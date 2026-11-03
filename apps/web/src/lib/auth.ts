import type { AuthUser } from "./auth-cookie";

export async function signInWithGoogle(): Promise<AuthUser> {
    // TODO: call your real Google sign-in (Firebase / NextAuth / GIS) and map the result.
    // Example shape with Firebase:
    //   const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    //   return {
    //       id: user.uid,
    //       name: user.displayName ?? "",
    //       email: user.email ?? "",
    //       picture: user.photoURL ?? undefined,
    //   };
    throw new Error("signInWithGoogle not implemented");
}