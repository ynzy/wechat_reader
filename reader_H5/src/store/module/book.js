const book = {
  state: {
    fileName: '',
    menuVisible: false
  },
  mutations: {
    'SET_FILENAME': (state, fileName) => {
      state.fileName = fileName
    },
    'SET_MENUVISIBLE': (state, menuVisible) => {
      state.menuVisible = menuVisible
    },
  },
  actions: {
    setFileName: ({ commit }, fileName) => {
      // return 可以返回一个promise对象
      return commit('SET_FILENAME', fileName)
    },
  }
}

export default book