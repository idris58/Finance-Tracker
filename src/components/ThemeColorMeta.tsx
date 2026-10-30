import { useEffect } from "react";
import { useTheme } from "next-themes";

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    const color = isDark ? "#0f172a" : "#f8fafc";

    const metaTags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metaTags.length > 0) {
      metaTags.forEach((tag) => {
        tag.setAttribute("content", color);
      });
    } else {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
    }
  }, [resolvedTheme]);

  return null;
}

