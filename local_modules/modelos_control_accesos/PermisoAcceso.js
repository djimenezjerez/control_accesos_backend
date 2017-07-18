const moment = require('moment');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define('permisoAcceso', {
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fechaFin: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    paranoid: true,
    createdAt: false,
    updatedAt: false,
    defaultScope: {
      order: [['id', 'DESC']]
    },
    scopes: {
      indefinido: {
        where: {
          fechaFin: null
        }
      },
      temporalActual: {
        where: {
          $and: {
            fechaFin: {
              $ne: null
            },
            fechaFin: {
              $gte: new Date()
            }
          }
        }
      },
      temporalAnterior: {
        where: {
          $and: {
            fechaFin: {
              $ne: null
            },
            fechaFin: {
              $lt: new Date()
            }
          }
        }
      }
    },
    comment: 'Relación entre personas y puertas',
    name: {
      plural: 'PermisosAcceso',
      singular: 'PermisoAcceso'
    },
    classMethods: {
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
