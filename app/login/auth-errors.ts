// Maps Firebase Auth error codes / auth states to user-facing sign-in alerts.
// Pure functions — trivially testable, and keeps the form component focused on UI.

export type LoginAlert = { title: string; body: string };

export function alertForAuthError(code: string): LoginAlert {
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return {
      title: "Incorrect email or password",
      body: "The details don’t match an IBU account. Check for typos and try again.",
    };
  }
  if (code === "auth/user-not-found" || code === "auth/invalid-email") {
    return {
      title: "No account found",
      body: "We couldn’t find an IBU account for that email. Make sure you’re using your official @ibu.edu address.",
    };
  }
  return {
    title: "Sign-in failed",
    body: "Something went wrong signing you in. Please try again.",
  };
}
