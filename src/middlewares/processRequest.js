const processRequest = (source, role) => {
  // get roles from the database
  // then check if the role is admin and the source is web
  if (role === 'admin' && source === 'web') {
    return true;
  }
  return false;
};

export { processRequest };
