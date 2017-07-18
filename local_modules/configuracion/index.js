let configuracion = {
  depuracion: Boolean(Number(process.env.APP_DEPURACION)) || false,
  directorio: process.env.PROY_DIR || '/opt/control_accesos/backend',
  certificado: {
    nombre: process.env.CERT_NOMBRE || 'api_control_accesos',
    ruta: process.env.CERT_DIR || 'certs'
  },
  apiAdmin: {
    servidor: process.env.API_ADMIN_SERVIDOR || 'localhost',
    puerto: process.env.API_ADMIN_PUERTO || 3443,
    version: process.env.API_ADMIN_VERSION || 1
  },
  api: {
    servidor: process.env.API_SERVIDOR || 'localhost',
    puerto: process.env.API_PUERTO || 3000,
    version: process.env.API_VERSION || 1
  },
  registrador: {
    servidor: process.env.REGISTRADOR_SERVIDOR || 'localhost',
    puerto: process.env.REGISTRADOR_PUERTO || 3001,
    version: process.env.REGISTRADOR_VERSION || 1
  },
  puerta: {
    logicaAbierta: Boolean(Number(process.env.PUERTA_LOGICA_ABIERTA)) || false,
    tiempoAbierta: Number(process.env.PUERTA_TIEMPO_ABIERTA) || 6,
    retardoGrabacionHuella: Number(process.env.PUERTA_RETARDO_GRABACION_HUELLA) || 10
  },
  sensor: {
    cabecera: process.env.SENSOR_CABECERA || 'ef01',
    direccion: process.env.SENSOR_DIRECCION || 'ffffffff',
    tamanoPaquete: Number(process.env.SENSOR_TAMANO_PAQUETE) || 128,
    velocidad: Number(process.env.SENSOR_VELOCIDAD) || 57600,
    longitudClave: Number(process.env.SENSOR_LONGITUD_CLAVE) || 8
  },
  mqtt: {
    servidor: Number(process.env.IP_SERVIDOR),
    puerto: Number(process.env.MQTT_PUERTO) || 1883
  },
  baseDatos: {
    tipo: process.env.BASE_DATOS_TIPO || 'postgres',
    servidor: process.env.BASE_DATOS_SERVIDOR || 'localhost',
    puerto: Number(process.env.BASE_DATOS_PUERTO) || 5432,
    usuario: process.env.BASE_DATOS_USUARIO || 'postgres',
    clave: process.env.BASE_DATOS_CLAVE || '',
    bd: process.env.BASE_DATOS_NOMBRE || 'control_accesos'
  },
  microservicio: {
    tipo: process.env.MICROSERVICIO_PERSONAS_TIPO || 'postgres',
    servidor: process.env.MICROSERVICIO_PERSONAS_SERVIDOR || 'localhost',
    puerto: Number(process.env.MICROSERVICIO_PERSONAS_PUERTO) || 5432,
    usuario: process.env.MICROSERVICIO_PERSONAS_USUARIO || 'postgres',
    clave: process.env.MICROSERVICIO_PERSONAS_CLAVE || '',
    bd: process.env.MICROSERVICIO_PERSONAS_NOMBRE || 'microservicio_personas'
  },
  ldap: {
    servidor: process.env.LDAP_SERVIDOR || 'ldap.empresa.com',
    puerto: Number(process.env.LDAP_PUERTO) || 386,
    tls: Boolean(Number(process.env.LDAP_TLS)) || false,
    basedn: process.env.LDAP_BASEDN || 'ou=usuarios,dc=empresa,dc=com',
    identificador: process.env.LDAP_IDENTIFICADOR || 'uid'
  },
  backup: {
    ruta: process.env.BACKUP_RUTA || 'backup',
    numeroRespaldos: Number(process.env.BACKUP_NUMERO_RESPALDOS) || 12,
    tareaCron: process.env.BACKUP_TAREA_CRON || '0 0 0 * * 1',
    formatoFecha: process.env.BACKUP_FORMATO_FECHA || 'DD-MM-YYYY'
  },
  jwt: {
    tiempoExpiracion: process.env.JWT_EXPIRACION || '4h',
    algoritmo: process.env.JWT_ALGORITMO || 'RS256'
  },
  socket: {
    puerto: process.env.SOCKET_PUERTO || 4337
  }
}

module.exports = configuracion;
