const each = require('each');
const datos = require(`${__dirname}/test.json`);
const cfg = require('configuracion');
const logger = require('logger');
const modelos = require('modelos_control_accesos');
const Arduino = modelos.Arduino;
const Puerta = modelos.Puerta;
const ClienteMqtt = modelos.ClienteMqtt;
const Topico = modelos.Topico;
const ClienteTopicoPermiso = modelos.ClienteTopicoPermiso;

each(datos.arduinos)
.call((arduino, indice, siguiente) => {
  ClienteMqtt.create({
    usuario: arduino.usuario
  })
  .then((clienteNuevo) => {
    clienteNuevo.createArduino({
      mac: arduino.mac,
      ip: arduino.ip,
      control: arduino.control,
      detalle: arduino.detalle,
      pinesSalida: arduino.pinesSalida
    })
    .then((resultado) => {
      arduino.topicos.forEach((topico) => {
        Topico.findOrCreate({
          where: {
            nombre: topico.nombre,
          },
          defaults: {
            detalle: topico.detalle
          }
        })
        .then((topicoNuevo) => {
          ClienteTopicoPermiso.create({
            clienteMqtt: clienteNuevo.id,
            topico: topicoNuevo[0].id,
            permiso: topico.permiso
          })
          .then(() => {
            return null;
          })
          .catch((err) => {
            logger.error(err);
          });
          return null;
        })
        .catch((err) => {
          logger.error(err);
        });
      });
      return null;
    })
    .then((res) => {
      if(arduino.puerta != null) {
        clienteNuevo.getArduino()
        .then((arduinoNuevo) => {
          return arduinoNuevo.createPuertaSensor({
            nombre: arduino.puerta.nombre,
            pin: arduino.puerta.pin,
            detalle: arduino.puerta.detalle
          });
        })
        .then((resultado) => {
          return Promise.all([
            Puerta.findById(resultado.puerta),
            Arduino.findOne({
              puerta: null
            })
          ])
        })
        .then((relacion) => {
          arduino.puerta.personas.forEach((persona) => {
            relacion[0].createPermisoAcceso({
              persona: persona
            });
          })
          return relacion[0].setArduinoControl(relacion[1]);
        })
        .then((res) => {
          return true;
        })
        .catch((err) => {
          logger.error(err);
        });
        return null;
      }
      else {
        return true;
      }
    })
    .then((res) => {
      return siguiente();
    })
    .catch((err) => {
      return siguiente();
      logger.error(err);
    })
    return null;
  })
  .catch((err) => {
    siguiente();
    logger.error(err);
  })
})
.then((err) => {
  if(err) {
    logger.error(err);
  }
  else {
    logger.info('Insertados datos de prueba');
  }
});
