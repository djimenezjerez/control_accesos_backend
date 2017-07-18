const fs = require('fs');
const logger = require('logger');
const cfg = require('configuracion');
const modelos = require('modelos_control_accesos');
const Configuracion = modelos.Configuracion;
const Persona = modelos.Persona;
const Topico = modelos.Topico;
const ClienteMqtt = modelos.ClienteMqtt;
const relClienteTopicoPermiso = modelos.relClienteTopicoPermiso;
const microservicio = require('modelos_microservicio_personas');
const Personal = microservicio.Persona;
const datos = require(`${cfg.directorio}/datosInicialesBd.json`);

modelos.sequelize.sync({
  force: true
})
.then(() => {
  Topico.bulkCreate(datos.topicos)
  .then((topicos) => {
    logger.info(`Insertados tópicos mqtt`);
    datos.clientesMqtt.forEach((cliente) => {
      ClienteMqtt.create({
        id: cliente.id,
        usuario: cliente.usuario,
        clave: cliente.clave,
        admin: cliente.admin
      })
      .then((clienteRes) => {
        cliente.topicos.forEach((topico) => {
          Topico.findOne({
            where: {
              topico: topico.topico
            }
          })
          .then((topicoRes) => {
            return relClienteTopicoPermiso.create({
              clienteMqtt: clienteRes.id,
              topico: topicoRes.id,
              permiso: topico.permiso
            })
          })
          .then((resultado) => {
            logger.info(`Insertados permisos para tópicos de clientes mqtt`);
          })
          .catch((error) => {
            logger.error(error);
          });
        });
      })
      .catch((error) => {
        logger.error(error);
      });
    });
    return null;
  })
  .catch((error) => {
    logger.error(error);
  });

  return Personal.findAll({
    attributes: ['id', 'persona']
  })
})
.then((personal) => {
  personal.forEach((persona) => {
    Persona.create({
      id: persona.id,
      nombre: persona.persona
    })
    .then((resultado) => {
      logger.info(`Insertado registro ${persona.dataValues.id}`);
    })
    .catch((error) => {
      logger.error(error);
    });
  });
  return null;
})
.then(() => {
  fs.unlink(`${cfg.directorio}/datosInicialesBd.json`);
  return null;
})
.catch((error) => {
  logger.error(error);
});
