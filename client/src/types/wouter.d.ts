declare module 'wouter' {
  import { ComponentType, ReactNode } from 'react';

  export const Link: ComponentType<{
    href: string;
    children: ReactNode;
    className?: string;
    [props: string]: any;
  }>;

  export type LocationTuple = [string, (path: string) => void];
  export function useLocation(): LocationTuple;

  export const Router: ComponentType<{ children: ReactNode; [props: string]: any }>;
  export const Route: ComponentType<{
    path: string;
    component?: ComponentType<any>;
    children?: ReactNode;
  }>;
  export const Switch: ComponentType<{ children: ReactNode; [props: string]: any }>;
}