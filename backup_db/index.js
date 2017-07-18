const cron = require('node-cron');
const moment = require('moment');
const fs = require('fs');
const logger = require('logger');
const cfg = require('configuracion');
const exec = require('child_process').exec;

logger.info(`Iniciada tarea programada de backups de base de datos`);

if(!fs.existsSync(`${cfg.directorio}/${cfg.backup.ruta}`)) {
  fs.mkdirSync(`${cfg.directorio}/${cfg.backup.ruta}`);
  logger.info(`Creada carpeta de backups de la base de datos ${cfg.baseDatos.bd}`);
};

let buscarClientePostgres = (paquete) => {
  return new Promise((resolver, rechazar) => {
    exec(`dpkg --get-selections | grep ${paquete}`, (error, stdout, stderr) => {
      if(error !== null) {
        rechazar(error);
      }
      else {
        if(stdout.indexOf('install') > -1) {
          resolver(true);
        }
        else {
          rechazar(`No se encuentra el paquete ${paquete}\nEjecute: sudo apt install ${paquete}`);
        };
      };
    });
  });
};

let backupDb = (formato) => {
  return new Promise((resolver, rechazar) => {
    exec(`PGPASSWORD="${cfg.baseDatos.clave}" pg_dump -h ${cfg.baseDatos.servidor} -p ${cfg.baseDatos.puerto} -U ${cfg.baseDatos.usuario} -Ft ${cfg.baseDatos.bd} > ${cfg.directorio}/${cfg.backup.ruta}/${moment(new Date()).format(formato)}.tar`, (error, stdout, stderr) => {
      if(error !== null) {
        rechazar(error);
      }
      else {
        resolver(`${moment(new Date()).format(formato)}.tar`);
      };
    });
  });
};

let eliminarAntiguos = () => {
  return new Promise((resolver, rechazar) => {
    exec(`ls -1t ${cfg.directorio}/${cfg.backup.ruta} | tail -n +${cfg.backup.numeroRespaldos}`, (error, stdout, stderr) => {
      if(error !== null) {
        rechazar(error);
      }
      else {
        if(stdout.split('\n').length > 1) {
          stdout.split('\n').forEach((archivo) => {
            if(archivo != '') {
              fs.unlink(`${cfg.directorio}/${cfg.backup.ruta}/${archivo}`,(error) => {
                if(error) {
                  logger.error(error);
                }
                else {
                  logger.verbose(`Eliminado archivo ${archivo}`)
                }
              });
            };
          });
          resolver(stdout.split('\n').length - 1);
        }
        else {
          rechazar(`No hay elementos antiguos para eliminar`);
        };
      };
    });
  });
};

cron.schedule(cfg.backup.tareaCron, () => {
  buscarClientePostgres('postgresql-client')
  .then((instalado) => {
    if(instalado) {
      return backupDb(cfg.backup.formatoFecha)
    }
  })
  .then((resultado) => {
    logger.verbose(`Backup realizado: ${resultado}`);
    return eliminarAntiguos()
  })
  .then((eliminados) => {
    logger.info(`Eliminados ${eliminados} archivos`);
  })
  .catch((err) => {
    logger.error(err);
  })
});
