const each = require('each');
const logger = require('logger');
const cfg = require('configuracion');
const modelos = require('modelos_control_accesos');
const Persona = modelos.Persona;
const Puerta = modelos.Puerta;
const Acceso = modelos.Acceso;

let activarDesactivar = (puertaId, estado) => {
  return new Promise((resolver, rechazar) => {
    Puerta.findById(puertaId)
    .then((puerta) => {
      if((!cfg.puerta.logicaAbierta && puerta.estadoActual && !estado) || (!puerta.estadoActual && !puerta.estadoActual && estado)) {
        process.send({
          tipo: 'gpio',
          arduinoControl: puerta.arduinoControl,
          pin: puerta.pin,
          estado: Number(estado)
        });
        process.send({
          tipo: 'socket',
          canal: 'gpio',
          mensaje: {
            error: (puerta.estadoInicial === estado) ? false : true,
            id: puertaId,
            nombre: puerta.nombre,
            estadoInicial: puerta.estadoInicial,
            estadoActual: estado,
            detalle: puerta.detalle,
            pin: puerta.pin,
            fechaHora: new Date()
          }
        });
        return puerta.updateAttributes({
          estadoActual: estado
        })
      }
      else if(!cfg.puerta.logicaAbierta && !puerta.estadoActual && !estado) {
        logger.error(`La puerta ${puertaId} ya esta abierta`);
        return {
          puertaId: puertaId
        };
      }
      else {
        return {
          puertaId: puertaId
        };
      };
    })
    .then((puerta) => {
      resolver(puertaId);
    })
    .catch((error) => {
      rechazar(error);
    });
  });
};

let cerrarPuerta = (puertaId) => {
  activarDesactivar(puertaId, !cfg.puerta.logicaAbierta)
  .then((puertaId) => {})
  .catch((error) => {
    logger.error(error);
  });
};

let abrirPuerta = (puertaId) => {
  activarDesactivar(puertaId, cfg.puerta.logicaAbierta)
  .then((puertaId) => {
    setTimeout(() => {
      cerrarPuerta(puertaId)
    }, cfg.puerta.tiempoAbierta * 1000);
  })
  .catch((error) => {
    logger.error(error);
  });
};

process.on('message', (mensaje) => {
  switch(mensaje.tipo) {
    case 'gpio':
      abrirPuerta(Number(mensaje.puerta));
      break;
    default:
      logger.error(`No existe el canal ${mensaje.tipo}`);
  };
});
