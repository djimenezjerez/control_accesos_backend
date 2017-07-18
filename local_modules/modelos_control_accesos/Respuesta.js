module.exports = (sequelize, DataTypes) => {
  return sequelize.define('respuesta', {
    comando: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    respuesta: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    paranoid: true,
    comment: 'Historial de comandos y respuestas del hardware',
    name: {
      plural: 'Respuestas',
      singular: 'Respuesta'
    },
    classMethods: {
      associate: function(modelo) {
        this.belongsTo(modelo.Arduino, {
          foreignKey: 'arduino'
        });
      }
    }
  });
};
