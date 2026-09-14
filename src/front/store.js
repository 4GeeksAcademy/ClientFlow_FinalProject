export const initialStore = () => {
  return {
    // Recupera la sesión guardada en localStorage si recargas la página
    token: localStorage.getItem("jwt_token") || null,
    user: JSON.parse(localStorage.getItem("user_data")) || null,
    message: null,
    todos: []
  };
};

export default function storeReducer(store, action = {}) {
  switch (action.type) {
    case "SET_AUTH":
      return {
        ...store,
        token: action.payload.token,
        user: action.payload.user
      };

    case "CLEAR_AUTH":
      return {
        ...store,
        token: null,
        user: null
      };

    default:
      return store;
  }
}