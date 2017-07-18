module.exports = (sequelize, DataTypes) => {
  return sequelize.define('persona', {
    nombre: {
      type: DataTypes.STRING(45),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: {
          args: true,
          msg: 'Debe llenar este campo'
        },
        len: [3, 45]
      }
    },
    grabado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    paranoid: false,
    comment: 'Personas registradas en el sistema',
    name: {
      plural: 'Personas',
      singular: 'Persona'
    },
    classMethods: {
      associate: function(modelo) {
        this.hasMany(modelo.Acceso, {
          foreignKey: 'persona',
          onDelete: 'cascade'
        });
        this.hasMany(modelo.PermisoAcceso, {
          foreignKey: 'persona',
          onDelete: 'cascade'
        });
      }
    }
  });
};
