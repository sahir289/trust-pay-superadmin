import { tableName as dbTables } from '../constants/index.js';
import { BadRequestError, InternalServerError } from './appErrors.js';

const DataTypes = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
};

const tables = {
  [dbTables.MERCHANT]: {
    id: DataTypes.STRING,
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    code: DataTypes.STRING,
    min_payin: DataTypes.NUMBER,
    max_payin: DataTypes.NUMBER,
    payin_commission: DataTypes.NUMBER,
    min_payout: DataTypes.NUMBER,
    max_payout: DataTypes.NUMBER,
    payout_commission: DataTypes.NUMBER,
    is_test_mode: DataTypes.BOOLEAN,
    is_enabled: DataTypes.BOOLEAN,
    dispute_enabled: DataTypes.BOOLEAN,
    is_demo: DataTypes.BOOLEAN,
    balance: DataTypes.NUMBER,
    config: DataTypes.JSON,
  },
  [dbTables.VENDOR]: {
    id: DataTypes.STRING,
    user_id: DataTypes.STRING,
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    code: DataTypes.STRING,
    balance: DataTypes.NUMBER,
    created_by: DataTypes.STRING,
    config: DataTypes.JSON,
  },
  [dbTables.SETTLEMENT]: {
    id: DataTypes.STRING,
    sno: DataTypes.NUMBER,
    user_id: DataTypes.STRING,
    status: DataTypes.STRING,
    amount: DataTypes.NUMBER,
    method: DataTypes.STRING,
    config: DataTypes.JSON,
  },
  [dbTables.USER]: {
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: DataTypes.STRING,
    contact_no: DataTypes.STRING,
    user_name: DataTypes.STRING,
  },
  [dbTables.PAYIN]: {
    id: DataTypes.STRING,
    sno: DataTypes.NUMBER,
    upi_short_code: DataTypes.STRING,
    qr_params: DataTypes.STRING,
    amount: DataTypes.NUMBER,
    status: DataTypes.STRING,
    is_notified: DataTypes.BOOLEAN,
    user_submitted_utr: DataTypes.STRING,
    currency: DataTypes.STRING,
    merchant_order_id: DataTypes.STRING,
    user: DataTypes.STRING,
    bank_acc_id: DataTypes.STRING,
    merchant_id: DataTypes.STRING,
    config: DataTypes.JSON,
  },
  [dbTables.BANK_RESPONSE]: {
    sno: DataTypes.NUMBER,
    status: DataTypes.STRING,
    bank_id: DataTypes.STRING,
    amount: DataTypes.NUMBER,
    upi_short_code: DataTypes.STRING,
    utr: DataTypes.STRING,
    is_used: DataTypes.BOOLEAN,
  },
  [dbTables.BANK_ACCOUNT]: {
    sno: DataTypes.NUMBER,
    upi_id: DataTypes.STRING,
    acc_holder_name: DataTypes.STRING,
    nick_name: DataTypes.STRING,
    acc_no: DataTypes.STRING,
    ifsc: DataTypes.STRING,
    bank_name: DataTypes.STRING,
    payin_count: DataTypes.NUMBER,
    balance: DataTypes.NUMBER,
    bank_used_for: DataTypes.STRING,
    config: DataTypes.JSON,
  },
  [dbTables.CHECK_UTR_HISTORY]: {
    sno: DataTypes.NUMBER,
    payin_id: DataTypes.STRING,
    utr: DataTypes.STRING,
    config: DataTypes.JSON,
  },
};

/**
 * Searches for a value in the specified table column.
 *
 * @param {string} search - The search term.
 * @param {string} tableName - Table Name to build filter for
 * @example
 * searchInTable("first_name", "Merchant");
 * searchInTable("first_name, last_name", "Merchant");
 */

export const buildSearchFilterObj = (search, tableName) => {
  if (typeof search !== 'string') {
    throw new BadRequestError('Invalid Search Type');
  }
  const obj = tables[tableName];
  if (!obj || obj === undefined) {
    throw new InternalServerError(`Search table ${tableName} not found!`);
  }

  const filters = {};
  const values = search
    .trim()
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v);

  for (const value of values) {
    if (!value) continue;

    const toValue = ['true', 'false'].includes(value.toLowerCase())
      ? value.toLowerCase() === 'true'
      : !isNaN(value)
        ? Number(value)
        : value;

    const valueType =
      typeof toValue === 'boolean'
        ? DataTypes.BOOLEAN
        : typeof toValue === 'number'
          ? DataTypes.NUMBER
          : DataTypes.STRING;

    let matched = false;

    for (const column in obj) {
      const columnDef = obj[column];
      const columnType = columnDef.type || columnDef; // handle nested structure

      // here will handle top level fields
      if (columnType === valueType) {
        matched = true;
        if (filters[column]) {
          if (Array.isArray(filters[column])) {
            filters[column].push(toValue);
          } else {
            filters[column] = [filters[column], toValue];
          }
        } else {
          filters[column] = toValue;
        }
      }

      // here will handle JSON fields
      if (columnType === DataTypes.JSON && typeof toValue === 'string') {
        const jsonStructure = columnDef.structure || {};
        for (const nestedKey in jsonStructure) {
          matched = true;
          // it will generate single-level key compatible with buildSelectQuery
          const filterKey = `config_${nestedKey}_contains`;
          filters[filterKey] = toValue;
        }
      }
    }

    if (!matched) {
      if (!filters.or) filters.or = {};
      filters.or.$raw = toValue;
    }
  }

  return filters;
};

export const buildFilterConditions = (
  filters,
  tableConfigs,
  baseConditions = [],
  baseParams = [],
) => {
  let conditions = [...baseConditions];
  let queryParams = [...baseParams];

  Object.keys(filters).forEach((key) => {
    const value = filters[key];
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      key !== 'page' &&
      key !== 'limit'
    ) {
      let columnConditions = [];
      let jsonConditions = [];
      let paramIndex;

      // Find the first table with this column to determine its type
      const aliasWithKey = Object.keys(tableConfigs).find((alias) =>
        tableConfigs[alias].columns.includes(key),
      );
      const columnType = aliasWithKey
        ? tableConfigs[aliasWithKey].columnTypes[key] || 'string'
        : 'string';

      // Add the parameter value once based on type
      paramIndex = queryParams.length + 1;
      if (columnType === 'boolean') {
        queryParams.push(value === 'true' || value === true);
      } else if (columnType === 'number') {
        queryParams.push(parseFloat(value));
      } else if (typeof value === 'string' && value.includes(' ')) {
        const keywords = value.trim().split(' ').filter(Boolean);
        keywords.forEach((keyword) => {
          paramIndex = queryParams.length + 1;
          queryParams.push(`%${keyword}%`);
          if (aliasWithKey) {
            columnConditions.push(
              `${aliasWithKey}."${key}" ILIKE $${paramIndex}`,
            );
          }
          Object.keys(tableConfigs).forEach((alias) => {
            const { jsonFields = [] } = tableConfigs[alias];
            jsonFields.forEach((jsonField) => {
              jsonConditions.push(`${jsonField}::text ILIKE $${paramIndex}`);
            });
          });
        });
      } else {
        queryParams.push(columnType === 'string' ? `%${value}%` : value);
      }

      // Apply to columns
      Object.keys(tableConfigs).forEach((alias) => {
        const { columns = [], columnTypes = {} } = tableConfigs[alias];
        const colType = columnTypes[key] || 'string';
        if (columns.includes(key)) {
          if (colType === 'string' && !value.includes(' ')) {
            columnConditions.push(`${alias}."${key}" ILIKE $${paramIndex}`);
          } else {
            columnConditions.push(`${alias}."${key}" = $${paramIndex}`);
          }
        }
      });

      // Apply to JSON fields (only for string values)
      if (typeof value === 'string' && !value.includes(' ')) {
        Object.keys(tableConfigs).forEach((alias) => {
          const { jsonFields = [] } = tableConfigs[alias];
          jsonFields.forEach((jsonField) => {
            jsonConditions.push(`${jsonField}::text ILIKE $${paramIndex}`);
          });
        });
      }

      // Combine conditions
      if (columnConditions.length > 0 || jsonConditions.length > 0) {
        const combinedConditions = [...columnConditions];
        if (jsonConditions.length > 0) {
          combinedConditions.push(`(${jsonConditions.join(' OR ')})`);
        }
        conditions.push(`(${combinedConditions.join(' OR ')})`);
      }
    }
  });

  return { conditions, queryParams };
};
