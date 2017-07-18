const pgPubSub = require('pg-pubsub');
const arrayCompare = require("array-compare");
const each = require('each');
const logger = require('logger');
const cfg = require('configuracion');
const Persona = require('modelos_control_accesos').Persona;
const Personal = require('modelos_microservicio_personas').Persona;

let pubsub = new pgPubSub(`${cfg.microservicio.tipo}://${cfg.microservicio.usuario}:${cfg.microservicio.clave}@${cfg.microservicio.servidor}:${cfg.microservicio.puerto}/${cfg.microservicio.bd}`);

logger.info('Iniciado monitor de microservicio de personal');

let sincronizarIds = () => {
  return new Promise((resolver, rechazar) => {
    Promise.all([
      Persona.findAll({
        attributes: ['id', 'nombre'],
        order: [['id', 'ASC']]
      }),
      Personal.findAll({
        attributes: ['id', 'persona'],
        order: [['id', 'ASC']]
      })
    ])
    .then((res) => {
      let str = JSON.stringify(res[1]);
      str = str.replace(/persona/g, 'nombre');
      res[1] = JSON.parse(str);
      let comp = arrayCompare(res[0], res[1], 'id');

      each(comp.missing)
      .call((obj, indice, siguiente) => {
        Persona.destroy({
          where: {
            id: obj.a.id
          }
        })
        .then(() => {
          logger.info(`Eliminado registro antiguo (${obj.a.id}):${obj.a.nombre}`);
          siguiente();
        })
        .catch((err) => {
          logger.error(err);
          siguiente();
        });
      })
      .then((err) => {
        if(err) {
          rechazar(err);
        }
        else {
          each(comp.added)
          .call((obj, indice, siguiente) => {
            Persona.create(obj.b)
            .then(() => {
              logger.info(`Sincronizado registro nuevo (${obj.b.id}):${obj.b.nombre}`);
              siguiente();
            })
            .catch((err) => {
              logger.error(err);
              siguiente();
            });
          })
          .then((err) => {
            if(err) {
              rechazar(err);
            }
            else {
              resolver(comp);
            };
          });
        };
      });
    })
    .catch((err) => {
      rechazar(err);
    });
  });
};

let sincronizarNombres = () => {
  return new Promise((resolver, rechazar) => {
    Promise.all([
      Persona.findAll({
        attributes: ['id', 'nombre'],
        order: [['id', 'ASC']]
      }),
      Personal.findAll({
        attributes: ['id', 'persona'],
        order: [['id', 'ASC']]
      })
    ])
    .then((res) => {
      let str = JSON.stringify(res[1]);
      str = str.replace(/persona/g, 'nombre');
      res[1] = JSON.parse(str);
      let comp = arrayCompare(res[0], res[1], 'nombre');

      each(comp.missing)
      .call((obj, indice, siguiente) => {
        Persona.destroy({
          where: {
            id: obj.a.id
          }
        })
        .then(() => {
          logger.info(`Eliminado registro antiguo (${obj.a.id}):${obj.a.nombre}`);
          siguiente();
        })
        .catch((err) => {
          logger.error(err);
          siguiente();
        });
      })
      .then((err) => {
        if(err) {
          rechazar(err);
        }
        else {
          each(comp.added)
          .call((obj, indice, siguiente) => {
            Persona.create(obj.b)
            .then(() => {
              logger.info(`Sincronizado registro nuevo (${obj.b.id}):${obj.b.nombre}`);
              siguiente();
            })
            .catch((err) => {
              logger.error(err);
              siguiente();
            });
          })
          .then((err) => {
            if(err) {
              rechazar(err);
            }
            else {
              resolver(comp);
            };
          });
        };
      });
    })
    .catch((err) => {
      rechazar(err);
    });
  });
};

/**
 * @api {get} monitorMicroservicio Monitoreo de la sincronización de la base de datos con el microservicio
 * @apiVersion 2.0.0
 * @apiGroup MonitorMicroservicio
 * @apiSuccess {Boolean} error 1 para definir error, 0 para definir correcto
 * @apiSuccess {String} mensaje Mensaje de notificación
 * @apiSuccessExample {json} Success
 *    HTTP/2.0 200 OK
 *    {
 *      "error": false,
 *      "mensaje": "Comenzando sincronización"
 *    }
 */

let sincronizar = () => {
  process.send({
    tipo: 'socket',
    canal: 'monitorMicroservicio',
    mensaje: {
      mensaje: 'Comenzando sincronización',
      error: true
    }
  });
  logger.verbose(`Iniciada sincronización`);
  sincronizarIds()
  .then((res) => {
    return sincronizarNombres();
  })
  .then((res) => {
    process.send({
      tipo: 'socket',
      canal: 'monitorMicroservicio',
      mensaje: {
        mensaje: 'Sincronización completada',
        error: false
      }
    });
    logger.verbose(`Sincronización de personal completada`);
  })
  .catch((err) => {
    logger.error(err);
    process.send({
      tipo: 'socket',
      canal: 'monitorMicroservicio',
      mensaje: {
        mensaje: 'Fallo en la sincronización',
        error: true
      }
    });
    logger.verbose(`Terminada sincronización de personal`);
  });
};

sincronizar();

pubsub.addChannel('personal', (channelPayload) => {
  let personaId = Number(channelPayload.split(' ')[1]);
  switch(channelPayload.split(' ')[0]) {
    case 'INSERT':
      Personal.findById(personaId, {
        attributes: ['usuario']
      })
      .then((personal) => {
        Persona.findById(personaId, {
          paranoid: false
        })
        .then((persona) => {
          if(persona == null) {
            return Persona.create({
              id: personaId,
              nombre: personal.dataValues.usuario
            })
          }
          else {
            return persona.update({
              nombre: personal.dataValues.usuario,
              grabado: false
            })
            .then((persona) => {
              persona.setDataValue('deletedAt', null);
              return persona.save({
                paranoid: false
              });
            })
            .catch((err) => {
              logger.error(err);
            });
          }
        })
        .then((res) => {
          logger.info(`Insertado registro ${personaId}`);
        })
        .catch((err) => {
          logger.error(err);
        });
        return null;
      })
      .catch((error) => {
        logger.error(error);
      });
      break;
    case 'UPDATE':
      Personal.findById(personaId, {
        attributes: ['usuario']
      })
      .then((personal) => {
        Persona.update({
          nombre: personal.dataValues.usuario,
          grabado: false
        }, {
          where: {
            id: personaId
          }
        })
        .then((resultado) => {
          logger.info(`Actualizado registro ${personaId}`);
          return null;
        })
        .catch((error) => {
          logger.error(error);
        });
        return null;
      })
      .catch((error) => {
        logger.error(error);
      });
      break;
    case 'DELETE':
      Persona.destroy({
        where: {
          id: personaId
        }
      })
      .then((resultado) => {
        logger.info(`Eliminado registro ${personaId}`);
      })
      .catch((error) => {
        logger.error(error);
      });
      break;
    default:
      logger.error(channelPayload);
  };
});

process.on('message', (interrupcion) => {
  sincronizar();
});
