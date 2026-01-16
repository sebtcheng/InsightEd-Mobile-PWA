import React from 'react';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
                        <p className="text-slate-600 mb-4">The application encountered an unexpected error.</p>

                        <div className="bg-slate-100 p-4 rounded-lg overflow-auto max-h-48 text-xs font-mono text-slate-700 mb-6 border border-slate-200">
                            {this.state.error && this.state.error.toString()}
                        </div>

                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full py-3 bg-[#004A99] text-white font-bold rounded-xl hover:bg-blue-800 transition"
                        >
                            Return to Login
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
