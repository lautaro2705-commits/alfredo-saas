import React from 'react'
import { clearAuthData } from '@/core/services/api'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-800">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Algo salió mal</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Ha ocurrido un error en la aplicación.</p>
            <button
              onClick={() => {
                clearAuthData()
                window.location.href = '/login'
              }}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
            >
              Volver al Login
            </button>
            <details className="mt-4 text-left text-sm text-gray-500 dark:text-gray-400">
              <summary>Detalles del error</summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
