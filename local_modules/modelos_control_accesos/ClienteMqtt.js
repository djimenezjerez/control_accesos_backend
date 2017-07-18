const hasher = require('hasher');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('clienteMqtt', {
    usuario: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        }
      }
    },
    clave: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        }
      },
      defaultValue: 'claveInicial'
    },
    conectado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    paranoid: false,
    comment: 'Lista de clientes válidos para conexión MQTT',
    hooks: {
      beforeCreate: (cliente, opciones) => {
        return hasher.hash(cliente.clave)
        .then((claveHash) => {
          cliente.clave = claveHash;
          return null;
        })
        .catch((err) => {
          console.log(err);
        })
      },
      beforeUpdate: (cliente, opciones) => {
        return hasher.hash(cliente.clave)
        .then((claveHash) => {
          cliente.clave = claveHash;
          return null;
        })
        .catch((err) => {
          console.log(err);
        })
      },
      beforeSave: (cliente, opciones) => {
        return hasher.hash(cliente.clave)
        .then((claveHash) => {
          cliente.clave = claveHash;
          return null;
        })
        .catch((err) => {
          console.log(err);
        })
      },
      beforeUpsert: (cliente, opciones) => {
        return hasher.hash(cliente.clave)
        .then((claveHash) => {
          cliente.clave = claveHash;
          return null;
        })
        .catch((err) => {
          console.log(err);
        })
      }
    },
    name: {
      plural: 'ClientesMqtt',
      singular: 'ClienteMqtt'
    },
    classMethods: {
      associate: function(modelo) {
        this.hasOne(modelo.Arduino, {
          foreignKey: 'clienteMqtt'
        });
        this.belongsToMany(modelo.Topico, {
          foreignKey: 'clienteMqtt',
          through: 'clienteTopicoPermiso',
          onDelete: 'cascade'
        });
      }
    }
  });
};
