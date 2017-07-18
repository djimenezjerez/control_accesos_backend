module.exports = (sequelize, DataTypes) => {
  return sequelize.define('acceso', {}, {
    comment: 'Historial de acceso de usuarios por las puertas',
    createdAt: 'fechaHora',
    updatedAt: false,
    name: {
      plural: 'Accesos',
      singular: 'Acceso'
    },
    classMethods: {
      paranoid: true,
      associate: function(modelo) {
        this.belongsTo(modelo.Persona, {
          foreignKey: 'persona'
        });
        this.belongsTo(modelo.Puerta, {
          foreignKey: 'puerta'
        });
      }
    }
  });
};
