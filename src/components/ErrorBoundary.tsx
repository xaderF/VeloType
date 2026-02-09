import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md space-y-6 text-center">
            <h1 className="text-3xl font-bold text-white">Something went wrong</h1>
            <p className="text-lobby-text-muted">
              An unexpected error occurred. You can try recovering or return to the home&nbsp;page.
            </p>
            {this.state.error && (
              <pre className="overflow-auto rounded-md bg-black/40 p-4 text-left text-xs text-red-400">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={this.handleReset}
                className="rounded-md bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/80"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
