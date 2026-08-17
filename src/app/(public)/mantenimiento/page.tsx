export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '50px 20px',
        maxWidth: '600px',
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px',
        }}>
          🔧
        </div>
        <h1 style={{
          fontSize: '32px',
          color: '#333',
          marginBottom: '16px',
          fontWeight: '600',
        }}>
          Mantenimiento en progreso
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#666',
          marginBottom: '16px',
          lineHeight: '1.6',
        }}>
          Estamos realizando tareas de mantenimiento en nuestro sistema.
        </p>
        <p style={{
          fontSize: '18px',
          color: '#666',
          marginBottom: '16px',
          lineHeight: '1.6',
        }}>
          Volveremos a estar disponibles en breve.
        </p>
        <p style={{
          fontSize: '16px',
          color: '#999',
          marginTop: '40px',
        }}>
          Gracias por tu paciencia.
        </p>
      </div>
    </div>
  );
}
