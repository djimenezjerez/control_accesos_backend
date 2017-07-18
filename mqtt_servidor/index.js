const mosca = require('mosca');
const logger = require('logger');
const cfg = require('configuracion');
const ip = require('obtener_ip');
const autorizacion = require(`${__dirname}/autorizacion`);
const conexionCliente = require(`${__dirname}/conexionCliente`);
const accesos = require(`${__dirname}/accesos`);
const sensores = require(`${__dirname}/sensores`);
const modelos = require('modelos_control_accesos');
const ClienteMqtt = modelos.ClienteMqtt;
const Respuesta = modelos.Respuesta;
const Sensor = require('sensor');
const child = require('child_process');

const gpio = child.fork(`${__dirname}/gpio/index`);
const api = child.fork(`${__dirname}/api/index`);
const monitorMicroservicio = child.fork(`${__dirname}/monitor_microservicio_personas/index`);
global.socket = child.fork(`${__dirname}/socket/index`);

let sensor = new Sensor(cfg.sensor.direccion, cfg.sensor.tamanoPaquete, cfg.sensor.velocidad, cfg.sensor.cabecera);

global.ocupado = false;
global.iniciado = false;
global.conectado = false;

ClienteMqtt.update({
  conectado: false
}, {
  where: {}
})
.then(() => {
  logger.verbose('Clientes reiniciados');
  global.conectado = true;
})
.catch((error) => {
  logger.error(error);
  process.exit(1);
});

let broker = new mosca.Server({
  port: cfg.mqtt.puerto
});

broker.on('ready', () => {
  broker.authenticate = autorizacion.autenticar;
  broker.authorizePublish = autorizacion.publicacion;
  broker.authorizeSubscribe = autorizacion.suscripcion;
  logger.info(`Servidor MQTT iniciado en mqtt://${(cfg.mqtt.servidor) ? cfg.mqtt.servidor : ip.obtenerIP()}:${cfg.mqtt.puerto}`);
  global.iniciado = true;
  setTimeout(() => {
    broker.publish({
      topic: `c/0`,
      payload: '1'
    });
  }, 1000);
});

broker.on('clientConnected', (cliente) => {
  conexionCliente.registrarConectado(cliente);
});

broker.on('clientDisconnected', (cliente) => {
  conexionCliente.registrarDesconectado(cliente);
});

/**
 * @api {get} p/:idPuerta Notificar un acceso para una persona por una puerta
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiSuccess {Number} idPuerta es el ID numeral de una puerta de acuerdo a la base de datos
 * @apiSuccess {Number} mensaje Número ID de la persona que desea acceder por la puerta
 * @apiSuccessExample {String} Success
 *    mqtt pub -h localhost -p 1883 -i usuario -u usuario -P clave -t p/+ -m 1
*/

/**
 * @api {get} gpio/:idDispositivoControl/:pin Cambia el estado del pin especificado de un dispositivo de control
 * @apiVersion 2.0.0
 * @apiGroup GPIO
 * @apiSuccess {Number} idDispositivoControl Es el id del dispositivo de control
 * @apiSuccess {Number} pin Es uno de los pines definidos para el dispositivo de control
 * @apiSuccess {Number} mensaje Es el estado lógico que se desea setear en el pin
 * @apiSuccessExample {String} Success
 *    mqtt pub -h localhost -p 1883 -i usuario -u usuario -P clave -t gpio/1/0 -m 1
*/

/**
 * @api {get} c/:idDispositivoSensor Cambiar el modo de los dispositivos de interfaz sensorial
 * @apiVersion 2.0.0
 * @apiGroup Comandos
 * @apiSuccess {Number} idDispositivoSensor Es el id del dispositivo interfaz sensorial o 0 para todos los dispositivos
 * @apiSuccess {Number} mensaje Es el estado, 0 para modo puente serial y 1 para modo búsqueda de huellas
 * @apiSuccessExample {String} Success
 *    mqtt pub -h localhost -p 1883 -i usuario -u usuario -P clave -t c/2 -m 0
*/

/**
 * @api {get} r/:idDispositivoSensor Respuesta proviniente del sensor después de una acción
 * @apiVersion 2.0.0
 * @apiGroup Respuestas
 * @apiSuccess {Number} idDispositivoSensor Es el id del dispositivo interfaz sensorial que envía una respuesta
 * @apiSuccess {Number} mensaje Es la respuesta recibida del sensor ZFM-20
 * @apiSuccessExample {String} Success
 *    mqtt pub -h localhost -p 1883 -i usuario -u usuario -P clave -t r/2 -m 01
*/

/**
 * @api {get} cmd/:comando/:destino Enviar un comando a los sensores
 * @apiVersion 2.0.0
 * @apiGroup Comandos
 * @apiSuccess {String} comando Es el comando a ejecutar [grabar, borrar, verificarConexion]
 * @apiSuccess {Number} destino Es el id del sensor al cual se quiere enviar el comando o 0 para enviar a todos
 * @apiSuccess {Number} mensaje Es el id de la persona que se desea grabar o borrar, o cualquier valor para verificarConexion
 * @apiSuccessExample {String} Success
 *    mqtt pub -h localhost -p 1883 -i usuario -u usuario -P clave -t cmd/grabar/0 -m 12
*/

broker.on('published', (mensaje, cliente) => {
  if(mensaje.topic.split('/')[0] != '$SYS' && cliente != null) {
    switch(mensaje.topic.split('/')[0]) {
      case 'p':
        accesos.insertar(mensaje)
        .then((res) => {
          gpio.send({
            tipo: 'gpio',
            puerta: res.puerta
          });
        })
        .catch((err) => {
          logger.error(err);
        });
        break;
      case 'cmd':
        api.send({
          tipo: 'estado',
          ocupado: true
        })
        sensores.comandos(mensaje, broker)
        .then((res) => {
          api.send({
            tipo: 'estado',
            ocupado: false
          });
        })
        .catch((err) => {
          logger.error(err);
        });
        break;
      case 'r':
        Respuesta.create({
          respuesta: sensor.respuestas[mensaje.payload],
          arduino: Number(mensaje.topic.split('/')[1])
        })
        .then(() => {
          logger.verbose(`Arduino ${mensaje.topic.split('/')[1]} : ${sensor.respuestas[mensaje.payload]}`)
        });
        break;
      default:
        logger.verbose(`Cliente ${cliente.usuario} publica en ${mensaje.topic}: ${mensaje.payload}`);
    };
  };
});

broker.on('subscribed', (topico, cliente) => {
  logger.verbose(`Cliente ${cliente.usuario} suscrito a ${topico}`);
});

gpio.on('message', (mensaje) => {
  switch(mensaje.tipo) {
    case 'gpio':
      broker.publish({
        topic: `gpio/${mensaje.arduinoControl}/${mensaje.pin}`,
        payload: Number(mensaje.estado).toString()
      }, () => {
        logger.verbose(`Arduino: ${mensaje.arduinoControl}, Pin: ${mensaje.pin}, Estado: ${mensaje.estado}`);
      });
      break;
    case 'socket':
      global.socket.send({
        canal: mensaje.canal,
        mensaje: mensaje.mensaje
      });
      break;
    default:
      logger.error(`No existe el canal ${mensaje.tipo}`);
  };
});

api.on('message', (mensaje) => {
  switch(mensaje.tipo) {
    case 'comando':
      api.send({
        tipo: 'estado',
        ocupado: true
      });
      sensores.comandos({
        topic: `cmd/${mensaje.comando}/${mensaje.destino}`,
        payload: mensaje.huellas.join(',')
      }, broker)
      .then((res) => {
        api.send({
          tipo: 'estado',
          ocupado: false
        })
      })
      .catch((err) => {
        logger.error(err);
      });
      break;
    case 'puerta':
      accesos.insertar({
        topic: `p/${mensaje.puerta}`,
        payload: mensaje.persona.toString(16)
      })
      .then((res) => {
        gpio.send({
          tipo: 'gpio',
          puerta: res.puerta
        });
      })
      .catch((err) => {
        logger.error(err);
      });
      break;
    case 'socket':
      global.socket.send({
        canal: mensaje.canal,
        mensaje: mensaje.mensaje
      });
      break;
    case 'monitorMicroservicio':
      monitorMicroservicio.send({
        canal: 'sincronizar',
        error: false
      });
      break;
    default:
      logger.error(`No existe el canal ${mensaje.tipo}`);
  };
});

monitorMicroservicio.on('message', (mensaje) => {
  switch(mensaje.tipo) {
    case 'socket':
      global.socket.send({
        canal: mensaje.canal,
        mensaje: mensaje.mensaje
      });
      break;
    default:
      logger.error(`No existe el canal ${mensaje.tipo}`);
  };
});
