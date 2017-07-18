module.exports = (sequelize, DataTypes) => {
  let Arduino = sequelize.define('arduino', {
    mac: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    ip: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isIPv4: {
          args: true,
          msg: 'No es una dirección IP válida'
        },
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        }
      }
    },
    control: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    detalle: {
      type: DataTypes.TEXT
    },
    pinesSalida: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: true
    }
  }, {
    paranoid: false,
    comment: 'Arduinos conectados a la red del sistema',
    name: {
      plural: 'Arduinos',
      singular: 'Arduino'
    },
    scopes: {
      control: {
        where: {
          control: true
        }
      },
      sensor: {
        where: {
          control: false
        }
      }
    },
    hooks: {
      beforeDestroy: function(arduino) {
        if(arduino.control) {
          Arduino.modelo.Topico.destroy({
            where: {
              nombre: `gpio/${arduino.id}/+`,
            }
          })
          .then((res) => {
            return null;
          })
          .catch((err) => {
            console.error(err);
          });
        }
        else {
          Promise.all([
            Arduino.modelo.Arduino.count({
              where: {
                control: false
              }
            }),
            Arduino.modelo.Topico.destroy({
              where: {
                nombre: `r/${arduino.id}`
              }
            }),
            Arduino.modelo.Topico.destroy({
              where: {
                nombre: `c/${arduino.id}`
              }
            }),
            Arduino.modelo.Topico.destroy({
              where: {
                nombre: `p/${arduino.puerta}`,
              }
            }),
            Arduino.modelo.ClienteTopicoPermiso.destroy({
              where: {
                clienteMqtt: arduino.clienteMqtt
              }
            })
          ])
          .then((res) => {
            if(res[0] == 0) {
              Arduino.modelo.Topico.destroy({
                where: {
                  nombre: `c/0`
                }
              });
            }
            return null;
          })
          .catch((err) => {
            console.error(err);
          });
        }
      },
      afterCreate: function(arduino) {
        if(arduino.control) {
          Promise.all([
            arduino.getClienteMqtt(),
            Arduino.modelo.Topico.create({
              nombre: `gpio/${arduino.id}/+`,
              detalle: `Topico de control para el arduino ${arduino.id}`
            })
          ])
          .then((res) => {
            Arduino.modelo.ClienteTopicoPermiso.create({
              clienteMqtt: res[0].id,
              topico: res[1].id,
              permiso: 'suscripcion'
            });
            return null;
          })
          .catch((err) => {
            console.error(err);
          });
        }
        else {
          Promise.all([
            arduino.getClienteMqtt(),
            Arduino.modelo.Topico.create({
              nombre: `r/${arduino.id}`,
              detalle: `Topico de respuestas del arduino ${arduino.id}`
            }),
            Arduino.modelo.Topico.create({
              nombre: `c/${arduino.id}`,
              detalle: `Topico de comandos para el arduino ${arduino.id}`
            }),
            Arduino.modelo.Topico.findOrCreate({
              where: {
                nombre: `c/0`
              },
              defaults: {
                detalle: `Topico de comandos para todos los arduinos`
              }
            }),
            Arduino.modelo.Topico.create({
              nombre: `p/${arduino.puerta}`,
              detalle: `Topico de puerta para el arduino ${arduino.id}`
            })
          ])
          .then((res) => {
            Arduino.modelo.ClienteTopicoPermiso.create({
              clienteMqtt: res[0].id,
              topico: res[1].id,
              permiso: 'publicacion'
            });
            Arduino.modelo.ClienteTopicoPermiso.create({
              clienteMqtt: res[0].id,
              topico: res[2].id,
              permiso: 'suscripcion'
            });
            Arduino.modelo.ClienteTopicoPermiso.create({
              clienteMqtt: res[0].id,
              topico: res[3][0].id,
              permiso: 'suscripcion'
            });
            Arduino.modelo.ClienteTopicoPermiso.create({
              clienteMqtt: res[0].id,
              topico: res[4].id,
              permiso: 'publicacion'
            });
            return null;
          })
          .catch((err) => {
            console.error(err);
          });
        }
        return null;
      }
    },
    classMethods: {
      associate: function(modelo) {
        Arduino.modelo = modelo;
        this.belongsTo(modelo.ClienteMqtt, {
          foreignKey: 'clienteMqtt'
        });
        this.belongsTo(modelo.Puerta, {
          as: 'PuertaSensor',
          foreignKey: 'puerta'
        });
        this.hasMany(modelo.Puerta, {
          as: 'PuertaControl',
          foreignKey: 'arduinoControl',
          constraints: false
        });
        this.hasMany(modelo.Respuesta, {
          foreignKey: 'arduino',
          onDelete: 'cascade'
        });
      }
    }
  });

  return Arduino;
};
