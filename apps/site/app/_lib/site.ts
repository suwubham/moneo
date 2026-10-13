const web = (process.env.APP_WEB_URL || "http://localhost:3031").replace(/\/$/, "");

export const site = {
  name: "Moneo",
  url: process.env.APP_SITE_URL || "http://localhost:3030",
  app: web,
  signUp: `${web}/sign-up`,
  signIn: `${web}/sign-in`,
};

export const sections = [
  { id: "features", label: "Features" },
  { id: "ask", label: "Ask it" },
  { id: "data", label: "Your data" },
] as const;
