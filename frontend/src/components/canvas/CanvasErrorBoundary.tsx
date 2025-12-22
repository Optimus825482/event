"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Canvas Error Boundary - Canvas bileşenlerindeki hataları yakalar
 * Requirement: Robust error handling for canvas operations
 */
export class CanvasErrorBoundary extends Component<Props, State> {
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Production'da hata raporlama servisi entegrasyonu yapılabilir
    if (process.env.NODE_ENV === "production") {
      // Sentry, LogRocket vb. entegrasyonu
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center w-full h-full min-h-[400px] bg-gray-50 dark:bg-gray-900 p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-lg">Canvas Hatası</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Canvas yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin
                veya tekrar deneyin.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-md">
                  <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleReset}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tekrar Dene
                </Button>
                <Button variant="default" size="sm" onClick={this.handleReload}>
                  Sayfayı Yenile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CanvasErrorBoundary;
