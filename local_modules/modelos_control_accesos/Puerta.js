module.exports = (sequelize, DataTypes) => {
  return sequelize.define('puerta', {
    nombre: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        },
        len: [3, 30]
      }
    },
    pin: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        }
      }
    },
    estadoInicial: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    estadoActual: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    detalle: {
      type: DataTypes.TEXT
    }
  }, {
    paranoid: false,
    comment: 'Lista de puertas',
    name: {
      plural: 'Puertas',
      singular: 'Puerta'
    },
    classMethods: {
      associate: function(modelo) {
        this.hasOne(modelo.Arduino, {
          as: 'ArduinoSensor',
          foreignKey: 'puerta',
          onDelete: 'cascade'
        });
        this.belongsTo(modelo.Arduino, {
          as: 'ArduinoControl',
          foreignKey: 'arduinoControl',
          constraints: false
        });
        this.hasMany(modelo.Acceso, {
          foreignKey: 'puerta',
          onDelete: 'cascade'
        });
        this.hasMany(modelo.PermisoAcceso, {
          foreignKey: 'puerta',
          onDelete: 'cascade'
        });
      }
    }
  });
};
