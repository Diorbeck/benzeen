declare module 'nprogress' {
  export function start(): void;
  export function done(): void;
  export function configure(options: { showSpinner?: boolean; minimum?: number; trickleSpeed?: number }): void;
}
