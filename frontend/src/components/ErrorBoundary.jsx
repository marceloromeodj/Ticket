import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Sin esto, cualquier excepción sin capturar durante el render (una fecha
// inválida, un campo inesperado en la respuesta de la API, etc.) desmonta
// toda la aplicación y deja la pantalla en blanco. Con esto, el error
// queda contenido y el usuario puede volver atrás sin perder la sesión.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
          <AlertTriangle size={32} className="text-amber-500 mb-3" />
          <p className="font-semibold text-gray-900">Ocurrió un error al mostrar esta pantalla</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => this.setState({ error: null })} className="btn-ghost text-sm">
              Reintentar
            </button>
            <button onClick={() => window.location.href = '/'} className="btn-primary text-sm">
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
