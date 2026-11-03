// Catches a crash inside a page so the rest of the app (navigation) keeps working.

import { Component } from "react";
import ErrorState from "./ErrorState";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container page">
          <ErrorState
            title="This page hit a problem"
            error={{ message: "Something unexpected happened while showing this page." }}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
