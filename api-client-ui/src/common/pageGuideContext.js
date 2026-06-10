let currentPageGuideContext = {};

export const setPageGuideContext = (context = {}) => {
  currentPageGuideContext = context && typeof context === "object" ? context : {};
};

export const clearPageGuideContext = () => {
  currentPageGuideContext = {};
};

export const getPageGuideContext = () => currentPageGuideContext;
