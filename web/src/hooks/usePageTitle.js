import { useEffect } from "react";

// Sets the browser tab title for a page.
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · MyMakanRoute` : "MyMakanRoute";
  }, [title]);
}
