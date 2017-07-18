const each = require('each');
const Sensor = require('sensor');
const cfg = require('configuracion');
const logger = require('logger');
const modelos = require('modelos_control_accesos');
const Persona = modelos.Persona;
const Respuesta = modelos.Respuesta;
const microservicio = require('modelos_microservicio_personas');
const Personal = microservicio.Persona;
const Huella = microservicio.Huella;

module.exports = {};

let sensor = new Sensor(cfg.sensor.direccion, cfg.sensor.tamanoPaquete, cfg.sensor.velocidad, cfg.sensor.cabecera);
let tiempoRetardo = cfg.puerta.retardoGrabacionHuella * 1000;

let cambiarModoSensor = (destino, modo, broker) => {
  return new Promise((resolver, rechazar) => {
    broker.publish({
      topic: `c/${destino}`,
      payload: modo.toString()
    }, () => {
      setTimeout(() => {
        resolver(true);
      }, tiempoRetardo);
    });
  })
};

let comandos = (mensaje, broker) => {
  return new Promise((resolver, rechazar) => {
    if(!global.ocupado && mensaje.topic.split('/')[2] != '' && mensaje.topic.split('/')[2] != null) {
      let comando = mensaje.topic.split('/')[1];
      let destino = mensaje.topic.split('/')[2];
      let datos = mensaje.payload.toString().split(',');
      global.ocupado = true;
      switch(comando) {
        case 'grabar':
          cambiarModoSensor(destino, 0, broker)
          .then(() => {
            each(datos)
            .call((idHuella, indiceHuella, siguienteHuella) => {
              Huella.findById(Number(idHuella))
              .then((res) => {
                if(res != null) {
                  Respuesta.create({
                    comando: `Enviando huella ${idHuella}`
                  })
                  .then(() => {
                    global.socket.send({
                      canal: 'comandos',
                      mensaje: {
                        error: true,
                        mensaje: `Enviando huella ${idHuella}`
                      }
                    });
                    logger.info(`Enviando huella ${idHuella}`);
                  });
                  broker.publish({
                    topic: `c/${destino}`,
                    payload: sensor.downChar()
                  }, () => {
                    setTimeout(() => {
                      each(sensor.armarDato(res.dataValues.plantilla))
                      .call((plantilla, indicePlantilla, siguientePlantilla) => {
                        broker.publish({
                          topic: `c/${destino}`,
                          payload: plantilla
                        }, () => {
                          global.socket.send({
                            canal: 'comandos',
                            mensaje: {
                              error: true,
                              mensaje: `Enviada cadena ${indicePlantilla} de huella ${idHuella}`
                            }
                          });
                          logger.verbose(`Enviada cadena ${indicePlantilla} de huella ${idHuella}`);
                          setTimeout(siguientePlantilla, tiempoRetardo);
                        });
                      })
                      .then((error) => {
                        broker.publish({
                          topic: `c/${destino}`,
                          payload: sensor.store(Number(idHuella))
                        }, () => {
                          setTimeout(siguienteHuella, tiempoRetardo);
                        });
                        Persona.update({
                          grabado: true
                        }, {
                          where: {
                            id: Number(idHuella)
                          }
                        })
                        .then((res) => {
                          global.socket.send({
                            canal: 'comandos',
                            mensaje: {
                              error: true,
                              mensaje: `Huella ${idHuella} enviada`
                            }
                          });
                          logger.info(`Huella ${idHuella} enviada`);
                        })
                        .catch((error) => {
                          logger.error(error);
                        });
                      })
                    }, tiempoRetardo);
                  });
                }
                else {
                  global.socket.send({
                    canal: 'comandos',
                    mensaje: {
                      error: true,
                      mensaje: `Huella ${idHuella} no encontrada`
                    }
                  });
                  logger.error(`Huella ${idHuella} no encontrada`);
                  setTimeout(siguienteHuella, tiempoRetardo);
                }
              })
              .catch((error) => {
                logger.error(error);
                setTimeout(siguienteHuella, tiempoRetardo);
              });
            })
            .then((error) => {
              cambiarModoSensor(destino, 1, broker)
              .then((res) => {
                if(error) {
                  rechazar(error.message);
                }
                else {
                  global.socket.send({
                    canal: 'comandos',
                    mensaje: {
                      error: true,
                      mensaje: 'Terminada la grabación de todas las huellas'
                    }
                  });
                  logger.info('Terminada la grabación de todas las huellas');
                  global.socket.send({
                    canal: 'comandos',
                    mensaje: {
                      error: false,
                      mensaje: 'Activando nuevamente los sensores'
                    }
                  });
                  logger.info('Activando nuevamente los sensores');
                  resolver({
                    comando: comando,
                    destino: destino,
                    huellas: datos
                  });
                };
                global.ocupado = false;
              });
            });
          })
          break;
        case 'borrar':
          cambiarModoSensor(destino, 0, broker)
          .then((res) => {
            each(datos)
            .call((idHuella, indiceIdHuella, siguienteIdHuella) => {
              Respuesta.create({
                comando: `Borrando huella ${idHuella}`
              });
              broker.publish({
                topic: `c/${destino}`,
                payload: (Number(idHuella) == 0) ? sensor.empty() : sensor.deletChar(Number(idHuella))
              }, () => {
                setTimeout(siguienteIdHuella, tiempoRetardo);
              });
              Persona.update({
                grabado: false
              }, {
                where: {
                  id: Number(idHuella)
                }
              })
              .then((res) => {
                global.socket.send({
                  canal: 'comandos',
                  mensaje: {
                    error: true,
                    mensaje: `Huella ${idHuella} borrada`
                  }
                });
                logger.info(`Huella ${idHuella} borrada`);
              })
              .catch((error) => {
                logger.error(error);
              });
            })
            .then((error) => {
              cambiarModoSensor(destino, 1, broker)
              .then((res) => {
                if(error) {
                  rechazar(error.message);
                }
                else {
                  global.socket.send({
                    canal: 'comandos',
                    mensaje: {
                      error: true,
                      mensaje: 'Terminada la eliminación de todas las huellas'
                    }
                  });
                  logger.info('Terminada la eliminación de todas las huellas');
                  global.socket.send({
                    canal: 'comandos',
                    mensaje: {
                      error: false,
                      mensaje: 'Activando nuevamente los sensores'
                    }
                  });
                  logger.info('Activando nuevamente los sensores');
                  resolver({
                    comando: comando,
                    destino: destino,
                    huellas: datos
                  });
                };
                global.ocupado = false;
              });
            });
          })
          break;
        case 'verificarConexion':
          cambiarModoSensor(destino, 0, broker)
          .then(() => {
            global.socket.send({
              canal: 'comandos',
              mensaje: {
                error: true,
                mensaje: (destino == 0) ? `Verificando conexión con los sensores` : `Verificando conexión con el sensor ${destino}`
              }
            });
            logger.info((destino == 0) ? `Verificando conexión con los sensores` : `Verificando conexión con el sensor ${destino}`);
            return broker.publish({
              topic: `c/${destino}`,
              payload: sensor.handshake()
            }, () => {
              return Respuesta.create({
                comando: (destino == 0) ? `Verificando conexión con los sensores` : `Verificando conexión con el sensor ${destino}`
              })
            });
          })
          .then((res) => {
            return cambiarModoSensor(destino, 1, broker);
          })
          .then(() => {
            global.socket.send({
              canal: 'comandos',
              mensaje: {
                error: true,
                mensaje: 'Terminada la verificación de sensores'
              }
            });
            logger.info('Terminada la verificación de sensores');
            global.socket.send({
              canal: 'comandos',
              mensaje: {
                error: false,
                mensaje: 'Activando nuevamente los sensores'
              }
            });
            logger.info('Activando nuevamente los sensores');
            resolver({
              comando: comando,
              destino: destino
            });
            global.ocupado = false;
          })
          .catch((error) => {
            logger.error(error);
            cambiarModoSensor(destino, 1, broker)
            .then(() => {
              global.socket.send({
                canal: 'comandos',
                mensaje: {
                  error: false,
                  mensaje: 'Activando nuevamente los sensores'
                }
              });
              logger.info('Activando nuevamente los sensores');
              resolver({
                comando: comando,
                destino: destino
              });
              global.ocupado = false;
            });
          });
          break;
        default:
          rechazar(`Función inválida ${comando}`);
          global.ocupado = false;
      };
    }
    else {
      rechazar('Ocupado enviando huellas');
    };
  });
}

module.exports.comandos = comandos;
