import { createContext, forwardRef, useContext, useEffect, useState, type ReactNode } from 'react';

type Ctx = {
  path: string;
  search: string;
  fullPath: string;
  navigate: (to: string) => void;
};

const R = createContext<Ctx | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState(window.location.pathname);
  const [s, setS] = useState(window.location.search);

  useEffect(() => {
    const o = () => {
      setP(window.location.pathname);
      setS(window.location.search);
    };
    window.addEventListener('popstate', o);
    return () => window.removeEventListener('popstate', o);
  }, []);

  function n(t: string) {
    window.history.pushState({}, '', t);
    try {
      const url = new URL(t, window.location.origin);
      setP(url.pathname);
      setS(url.search);
    } catch {
      setP(t.split('?')[0]);
      setS(t.includes('?') ? '?' + t.split('?').slice(1).join('?') : '');
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  const fullPath = p + s;

  return <R.Provider value={{ path: p, search: s, fullPath, navigate: n }}>{children}</R.Provider>;
}

export function useRouter() {
  const c = useContext(R);
  if (!c) throw new Error('useRouter');
  return c;
}

export const Link = forwardRef<HTMLAnchorElement, { to: string; children: ReactNode; className?: string; onClick?: () => void; [key: string]: any }>(
  function Link({ to, children, className, onClick, ...rest }, ref) {
    const { navigate } = useRouter();
    return (
      <a
        ref={ref}
        href={to}
        className={className}
        onClick={e => {
          e.preventDefault();
          navigate(to);
          onClick?.();
        }}
        {...rest}
      >
        {children}
      </a>
    );
  }
);

