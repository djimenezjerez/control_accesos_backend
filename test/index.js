process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const cfg = require('configuracion');
const supertest = require("supertest");
const should = require("should");
const ip = require('obtener_ip');

const api = supertest.agent(`https://${ip.obtenerIP()}:${cfg.api.puerto}/v${cfg.api.version}`);

describe('Verificar disponibilidad del servidor', () => {
  it('GET /huellas - Retorna el estado del servidor', (done) => {
    api
    .get('/huellas')
    .expect('Content-type', /json/)
    .expect(200)
    .end((error, respuesta) => {
      respuesta.status.should.equal(200);
      respuesta.body.mensaje.should.equal('Servicio disponible');
      done();
    });
  });
});

describe('Grabar nuevas huellas a todos los sensores', () => {
  it('PUT /huellas/grabar - Retorna el estado del servidor', (done) => {
    api
    .put('/huellas/grabar')
    .send({
      destino: 0,
      huellas: [1,2]
    })
    .expect('Content-type', /json/)
    .expect(200)
    .end((error, respuesta) => {
      respuesta.status.should.equal(200);
      respuesta.body.mensaje.should.equal('Grabando huellas 1,2');
      done();
    });
  });
});

setTimeout(() => {
  describe('Verificar conexión con los sensores', () => {
    it('GET /huellas - Retorna el estado de la conexión de los sensores', (done) => {
      api
      .get('/sensores/verificarConexion/0')
      .expect('Content-type', /json/)
      .expect(200)
      .end((error, respuesta) => {
        respuesta.should.be.text;
        done();
      });
    });
  });
}, 30000);

describe('Verificar disponibilidad del servidor', () => {
  it('GET /huellas - Retorna el estado del servidor ocupado', (done) => {
    api
    .get('/huellas')
    .expect('Content-type', /json/)
    .expect(409)
    .end((error, respuesta) => {
      respuesta.status.should.equal(409);
      respuesta.body.error.should.equal('Servidor ocupado');
      done();
    });
  });
});

describe('Obtener programa para un dispositivo controlador', () => {
  it('GET /programa/control/1 - Retorna el programa de arduino para un controlador', (done) => {
    api
    .get('/programa/control/1')
    .expect('Content-type', /text/)
    .expect(200)
    .end((error, respuesta) => {
      respuesta.should.be.text;
      done();
    });
  });
});

describe('Obtener programa para una interfaz sensorial', () => {
  it('GET /programa/sensor/2 - Retorna el programa de arduino para una interfaz sensorial', (done) => {
    api
    .get('/programa/sensor/2')
    .expect('Content-type', /text/)
    .expect(200)
    .end((error, respuesta) => {
      respuesta.should.be.text;
      done();
    });
  });
});

describe('Abrir puerta con el ID de alguna persona', () => {
  it('POST /puertas - Abrir puerta mediante la API', (done) => {
    api
    .post('/puertas')
    .send({
      persona: 3,
      puerta: 1
    })
    .expect('Content-type', /json/)
    .expect(200)
    .end((error, respuesta) => {
      respuesta.status.should.equal(200);
      respuesta.body.mensaje.should.equal('Abriendo puerta 1');
      done();
    });
  });
});

describe('Intentar abrir puerta con un ID sin permisos', () => {
  it('POST /puertas - Abrir puerta mediante la API', (done) => {
    api
    .post('/puertas')
    .send({
      persona: 3,
      puerta: 4
    })
    .expect('Content-type', /json/)
    .expect(401)
    .end((error, respuesta) => {
      respuesta.status.should.equal(401);
      respuesta.body.error.should.equal('Usuario 3 No autorizado');
      done();
    });
  });
});

setTimeout(() => {
  describe('Eliminar huellas de todos los sensores', () => {
    it('PUT /huellas/borrar - Retorna el estado del servidor', (done) => {
      api
      .put('/huellas/borrar')
      .send({
        destino: 0,
        huellas: [2,3]
      })
      .expect('Content-type', /json/)
      .expect(200)
      .end((error, respuesta) => {
        respuesta.status.should.equal(200);
        respuesta.body.mensaje.should.equal('Borrando huella 2,3');
        done();
      });
    });
  });
}, 45000);
