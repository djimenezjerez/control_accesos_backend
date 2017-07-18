const fs = require('fs');
const cfg = require('configuracion');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const spdy = require('spdy');
const logger = require('logger');
const ip = require('obtener_ip');
const respuestas = require(`${cfg.directorio}/respuestas`);
const key = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.key`);
const cert = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.crt`);

global.ocupado = false;

process.on('message', (mensaje) => {
  switch(mensaje.tipo) {
    case 'estado':
      global.ocupado = mensaje.ocupado;
      break;
    default:
      logger.error(`No existe el canal ${mensaje.tipo}`);
  };
});

app.use(require('morgan')('short', {
  stream: logger.stream
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(cors());
app.options('*', cors());

if(process.env.NODE_ENV != 'production') {
  app.use(`/v${cfg.api.version}/apidoc`, express.static(`${__dirname}/publico`));
}
app.use(`/v${cfg.api.version}/huellas`, require(`${__dirname}/rutas/huellas`));
app.use(`/v${cfg.api.version}/puertas`, require(`${__dirname}/rutas/puertas`));
app.use(`/v${cfg.api.version}/programas`, require(`${__dirname}/rutas/programas`));
app.use(`/v${cfg.api.version}/sensores`, require(`${__dirname}/rutas/sensores`));
app.use(`/v${cfg.api.version}/monitorMicroservicio`, require(`${__dirname}/rutas/monitorMicroservicio`));

spdy.createServer({
  key: key,
  cert: cert
}, app)
.listen(cfg.api.puerto, (error) => {
  if(error) {
    logger.error(error);
    return process.exit(1)
  }
  else {
    logger.info(`Servidor iniciado en https://${ip.obtenerIP()}:${cfg.api.puerto}`);
  };
});
