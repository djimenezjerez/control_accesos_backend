module.exports = (sequelize, DataTypes) => {
  return sequelize.define('clienteTopicoPermiso', {
    permiso: {
      type: DataTypes.ENUM('suscripcion', 'publicacion'),
      allowNull: true,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        }
      }
    }
  }, {
    paranoid: true,
    comment: 'Relación de los clientes, tópicos y permisos',
    name: {
      plural: 'ClienteTopicoPermisos',
      singular: 'ClienteTopicoPermiso'
    },
    classMethods: {
      associate: function(modelo) {
        this.belongsTo(modelo.Topico, {
          foreignKey: 'topico',
          onDelete: 'cascade'
        });
        this.belongsTo(modelo.ClienteMqtt, {
          foreignKey: 'clienteMqtt',
          onDelete: 'cascade'
        });
      }
    }
  });
};
