const pbkdf2 = require('mosquitto-pbkdf2');

exports.hash = (clave) => {
  return new Promise((resolver, rechazar) => {
    if(clave != '' || clave != null || clave != undefined) {
      pbkdf2.createPasswordAsync(clave, (claveHash) => {
        resolver(claveHash);
      });
    }
    else {
      rechazar('Clave inválida');
    };
  });
};

exports.verificarHash = (clave, claveHash) => {
  return new Promise((resolver, rechazar) => {
    if(clave != '' || clave != null || clave != undefined || claveHash != '' || claveHash != null || claveHash != undefined) {
      pbkdf2.verifyCredentials(clave, claveHash, (resultado) => {
        resolver(resultado);
      });
    }
    else {
      rechazar('Clave inválida');
    };
  });
};
