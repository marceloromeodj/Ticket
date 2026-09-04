// Documentación de la API externa de integraciones (/api/external/*), la
// pensada para que otros sistemas se conecten (no la API interna que usa
// el propio frontend, que no está pensada como contrato público estable).
module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'HelpDesk — API externa de integraciones',
    version: '1.0.0',
    description: 'API para que sistemas externos creen y consulten tickets. Generá un token en Configuración > API.',
  },
  servers: [{ url: '/api/external' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Token generado en Configuración > API' },
    },
    schemas: {
      TicketCreate: {
        type: 'object',
        required: ['subject', 'requester_email'],
        properties: {
          subject: { type: 'string', example: 'No puedo acceder a mi correo' },
          description: { type: 'string' },
          requester_name: { type: 'string', example: 'Juana Pérez' },
          requester_email: { type: 'string', format: 'email', example: 'juana@empresa.com' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          category_id: { type: 'string', format: 'uuid' },
          service_id: { type: 'string', format: 'uuid' },
        },
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ticket_number: { type: 'integer' },
          subject: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          requester_email: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/tickets': {
      get: {
        summary: 'Listar tickets',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
        ],
        responses: {
          200: {
            description: 'Lista de tickets',
            content: { 'application/json': { schema: { type: 'object', properties: { tickets: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } } } } } },
          },
          401: { description: 'Token inválido o ausente' },
        },
      },
      post: {
        summary: 'Crear un ticket',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TicketCreate' } } },
        },
        responses: {
          201: { description: 'Ticket creado' },
          400: { description: 'Faltan campos requeridos' },
          401: { description: 'Token inválido o ausente' },
        },
      },
    },
  },
};
