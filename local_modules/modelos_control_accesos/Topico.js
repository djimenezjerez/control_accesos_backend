module.exports = (sequelize, DataTypes) => {
  return sequelize.define('topico', {
    nombre: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Este campo no puede estar vacío'
        }
      }
    },
    detalle: {
      type: DataTypes.TEXT
    }
  }, {
    paranoid: false,
    comment: 'Lista de tópicos',
    name: {
      plural: 'Topicos',
      singular: 'Topico'
    },
    classMethods: {
      associate: function(modelo) {
        this.belongsToMany(modelo.ClienteMqtt, {
          foreignKey: 'topico',
          through: 'clienteTopicoPermiso',
          onDelete: 'cascade'
        });
      }
    }
  });
};
