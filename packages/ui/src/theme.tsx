const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeScript() {
  return (
    <script
      // React warns about rendered <script> tags on the client; this one only needs to run once, from the HTML.
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

export const themeColors = [
  { media: "(prefers-color-scheme: dark)", color: "#001b29" },
  { media: "(prefers-color-scheme: light)", color: "#fdf0d5" },
];
