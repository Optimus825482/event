"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary
 * Uygulama genelinde yakalanmamış hataları yakalar ve kullanıcı dostu bir hata sayfası gösterir
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Production'da hata raporlama servisi (Sentry vb.) entegrasyonu
    if (process.env.NODE_ENV === "production") {
      // TODO: Sentry.captureException(error, { extra: errorInfo });
      console.error("Error caught by boundary:", error, errorInfo);
    } else {
      console.error("Error caught by boundary:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback varsa onu göster
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Varsayılan hata sayfası
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Bir Hata Oluştu
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya ana
              sayfaya dönün.
            </p>

            {/* Development'ta hata detaylarını göster */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-left overflow-auto max-h-48">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReload}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sayfayı Yenile
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Ana Sayfa
              </Button>
            </div>

            <p className="mt-6 text-xs text-gray-500 dark:text-gray-500">
              Sorun devam ederse lütfen destek ekibiyle iletişime geçin.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional component wrapper for easier use
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
