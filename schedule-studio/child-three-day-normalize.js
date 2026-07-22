(() => {
  'use strict';

  if (window.__lifelineChildThreeDayNormalizerLoaded) return;
  window.__lifelineChildThreeDayNormalizerLoaded = true;

  const nativeStringify = JSON.stringify;

  function normalizeScheduleState(value) {
    if (!value || !Array.isArray(value.courses)) return value;
    value.courses.forEach((course) => {
      if (!course?.generatedChildThreeDay) return;
      if (['11:50', '11:55'].includes(course.preferredStart) && course.preferredEnd === '12:00') {
        course.name = '整理、洗手與餐前準備';
      }
      if (course.preferredStart === '16:50' && course.preferredEnd === '17:00') {
        course.name = '放學準備與家長交接';
      }
    });
    return value;
  }

  JSON.stringify = function lifelineStringify(value, replacer, space) {
    return nativeStringify.call(JSON, normalizeScheduleState(value), replacer, space);
  };
})();
