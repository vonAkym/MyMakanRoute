import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import EmptyState from "../components/EmptyState";
import usePageTitle from "../hooks/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <div className="container page">
      <h1 className="visually-hidden">Page not found</h1>
      <EmptyState
        icon={Compass}
        title="This page does not exist"
        action={
          <Link to="/" className="btn btn-primary">
            Go to the home page
          </Link>
        }
      >
        <p>The link may be old or mistyped.</p>
      </EmptyState>
    </div>
  );
}
