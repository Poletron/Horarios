/**
 * Servicio para manejo avanzado de filtros en el modo híbrido
 * Proporciona funcionalidades de búsqueda multi-criterio, presets y optimización
 */
export default {
  // Estado interno del servicio
  _state: {
    currentFilters: {
      text: '',
      subject: '',
      campus: '',
      schedule: {
        days: [],
        timeRange: { start: '', end: '' }
      },
      availability: 'all', // 'all', 'open', 'closed'
      professor: ''
    },
    presets: [],
    searchCache: new Map(),
    searchHistory: []
  },

  /**
   * Inicializa el servicio de filtros
   */
  init() {
    this.loadPresets();
    this.clearCache();
  },

  /**
   * Aplica filtros avanzados a una lista de cursos
   * @param {Array} courses - Lista de cursos a filtrar
   * @param {Object} filters - Objeto con los filtros a aplicar
   * @return {Array} Lista de cursos filtrados
   */
  applyFilters(courses, filters = null) {
    const activeFilters = filters || this._state.currentFilters;
    
    // Generar clave de cache
    const cacheKey = this._generateCacheKey(courses, activeFilters);
    
    // Verificar cache
    if (this._state.searchCache.has(cacheKey)) {
      return this._state.searchCache.get(cacheKey);
    }

    let filteredCourses = [...courses];

    // Filtro por texto (código, nombre, título)
    if (activeFilters.text && activeFilters.text.trim()) {
      const searchText = activeFilters.text.toLowerCase().trim();
      filteredCourses = filteredCourses.filter(course => 
        course.subject.toLowerCase().includes(searchText) ||
        course.courseNumber.toLowerCase().includes(searchText) ||
        course.courseTitle.toLowerCase().includes(searchText) ||
        `${course.subject}${course.courseNumber}`.toLowerCase().includes(searchText)
      );
    }

    // Filtro por materia específica
    if (activeFilters.subject && activeFilters.subject.trim()) {
      const subjectFilter = activeFilters.subject.toLowerCase().trim();
      filteredCourses = filteredCourses.filter(course =>
        course.subject.toLowerCase().includes(subjectFilter)
      );
    }

    // Filtro por campus
    if (activeFilters.campus && activeFilters.campus.trim()) {
      filteredCourses = filteredCourses.filter(course =>
        course.campusDescription === activeFilters.campus
      );
    }

    // Filtro por disponibilidad
    if (activeFilters.availability !== 'all') {
      const isOpen = activeFilters.availability === 'open';
      filteredCourses = filteredCourses.filter(course =>
        course.openSection === isOpen
      );
    }

    // Filtro por profesor
    if (activeFilters.professor && activeFilters.professor.trim()) {
      const professorFilter = activeFilters.professor.toLowerCase().trim();
      filteredCourses = filteredCourses.filter(course => {
        if (!course.meetingsFaculty || !Array.isArray(course.meetingsFaculty)) {
          return false;
        }
        return course.meetingsFaculty.some(meeting => {
          if (!meeting.faculty || !Array.isArray(meeting.faculty)) {
            return false;
          }
          return meeting.faculty.some(faculty => 
            faculty.displayName && 
            faculty.displayName.toLowerCase().includes(professorFilter)
          );
        });
      });
    }

    // Filtro por horario (días y rango de tiempo)
    if (activeFilters.schedule.days.length > 0 || 
        (activeFilters.schedule.timeRange.start && activeFilters.schedule.timeRange.end)) {
      filteredCourses = filteredCourses.filter(course => 
        this._matchesScheduleFilter(course, activeFilters.schedule)
      );
    }

    // Guardar en cache
    this._state.searchCache.set(cacheKey, filteredCourses);
    
    // Limpiar cache si es muy grande
    if (this._state.searchCache.size > 100) {
      this._clearOldCache();
    }

    return filteredCourses;
  },

  /**
   * Verifica si un curso coincide con los filtros de horario
   * @param {Object} course - Curso a verificar
   * @param {Object} scheduleFilter - Filtros de horario
   * @return {Boolean} true si coincide con los filtros
   */
  _matchesScheduleFilter(course, scheduleFilter) {
    if (!course.meetingDays || !Array.isArray(course.meetingDays)) {
      return false;
    }

    return course.meetingDays.some(meeting => {
      // Verificar días si están especificados
      if (scheduleFilter.days.length > 0) {
        const dayMapping = {
          'monday': meeting.monday,
          'tuesday': meeting.tuesday,
          'wednesday': meeting.wednesday,
          'thursday': meeting.thursday,
          'friday': meeting.friday,
          'saturday': meeting.saturday,
          'sunday': meeting.sunday
        };

        const hasMatchingDay = scheduleFilter.days.some(day => dayMapping[day]);
        if (!hasMatchingDay) {
          return false;
        }
      }

      // Verificar rango de tiempo si está especificado
      if (scheduleFilter.timeRange.start && scheduleFilter.timeRange.end) {
        return this._timeInRange(
          meeting.beginTime, 
          meeting.endTime,
          scheduleFilter.timeRange.start,
          scheduleFilter.timeRange.end
        );
      }

      return true;
    });
  },

  /**
   * Verifica si un horario está dentro del rango especificado
   * @param {String} beginTime - Hora de inicio del curso
   * @param {String} endTime - Hora de fin del curso
   * @param {String} rangeStart - Inicio del rango de búsqueda
   * @param {String} rangeEnd - Fin del rango de búsqueda
   * @return {Boolean} true si hay superposición
   */
  _timeInRange(beginTime, endTime, rangeStart, rangeEnd) {
    if (!beginTime || !endTime) return false;

    const toMinutes = timeStr => {
      if (!timeStr) return 0;
      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = parseInt(timeStr.substring(2), 10);
      return hours * 60 + minutes;
    };

    const courseStart = toMinutes(beginTime);
    const courseEnd = toMinutes(endTime);
    const filterStart = toMinutes(rangeStart.replace(':', ''));
    const filterEnd = toMinutes(rangeEnd.replace(':', ''));

    // Verificar si hay superposición
    return (courseStart < filterEnd) && (filterStart < courseEnd);
  },

  /**
   * Actualiza los filtros actuales
   * @param {Object} newFilters - Nuevos filtros a aplicar
   */
  updateFilters(newFilters) {
    this._state.currentFilters = { ...this._state.currentFilters, ...newFilters };
    this.clearCache(); // Limpiar cache cuando cambian los filtros
  },

  /**
   * Obtiene los filtros actuales
   * @return {Object} Filtros actuales
   */
  getCurrentFilters() {
    return { ...this._state.currentFilters };
  },

  /**
   * Limpia un filtro específico
   * @param {String} filterName - Nombre del filtro a limpiar
   */
  clearFilter(filterName) {
    const defaultValues = {
      text: '',
      subject: '',
      campus: '',
      schedule: { days: [], timeRange: { start: '', end: '' } },
      availability: 'all',
      professor: ''
    };

    if (defaultValues.hasOwnProperty(filterName)) {
      this._state.currentFilters[filterName] = defaultValues[filterName];
      this.clearCache();
    }
  },

  /**
   * Limpia todos los filtros
   */
  clearAllFilters() {
    this._state.currentFilters = {
      text: '',
      subject: '',
      campus: '',
      schedule: { days: [], timeRange: { start: '', end: '' } },
      availability: 'all',
      professor: ''
    };
    this.clearCache();
  },

  /**
   * Guarda un preset de filtros
   * @param {String} name - Nombre del preset
   * @param {Object} filters - Filtros a guardar (opcional, usa los actuales si no se especifica)
   * @return {Object} Preset guardado
   */
  savePreset(name, filters = null) {
    const preset = {
      id: Date.now().toString(),
      name: name.trim(),
      filters: filters || { ...this._state.currentFilters },
      createdAt: new Date(),
      isDefault: false
    };

    // Verificar que no existe un preset con el mismo nombre
    const existingIndex = this._state.presets.findIndex(p => p.name === preset.name);
    if (existingIndex >= 0) {
      this._state.presets[existingIndex] = preset;
    } else {
      this._state.presets.push(preset);
    }

    this._savePresets();
    return preset;
  },

  /**
   * Carga un preset de filtros
   * @param {String|Object} preset - ID del preset o objeto preset completo
   */
  loadPreset(preset) {
    let presetToLoad;
    
    if (typeof preset === 'string') {
      presetToLoad = this._state.presets.find(p => p.id === preset);
    } else {
      presetToLoad = preset;
    }

    if (presetToLoad && presetToLoad.filters) {
      this._state.currentFilters = { ...presetToLoad.filters };
      this.clearCache();
    }
  },

  /**
   * Elimina un preset
   * @param {String} presetId - ID del preset a eliminar
   */
  deletePreset(presetId) {
    this._state.presets = this._state.presets.filter(p => p.id !== presetId);
    this._savePresets();
  },

  /**
   * Obtiene todos los presets guardados
   * @return {Array} Lista de presets
   */
  getPresets() {
    return [...this._state.presets];
  },

  /**
   * Genera una clave de cache para los filtros
   * @param {Array} courses - Lista de cursos
   * @param {Object} filters - Filtros aplicados
   * @return {String} Clave de cache
   */
  _generateCacheKey(courses, filters) {
    const coursesHash = courses.length.toString();
    const filtersHash = JSON.stringify(filters);
    return `${coursesHash}_${btoa(filtersHash)}`;
  },

  /**
   * Limpia entradas antiguas del cache
   */
  _clearOldCache() {
    const entries = Array.from(this._state.searchCache.entries());
    // Mantener solo las 50 entradas más recientes
    const toKeep = entries.slice(-50);
    this._state.searchCache.clear();
    toKeep.forEach(([key, value]) => {
      this._state.searchCache.set(key, value);
    });
  },

  /**
   * Limpia todo el cache de búsqueda
   */
  clearCache() {
    this._state.searchCache.clear();
  },

  /**
   * Carga presets desde localStorage
   */
  loadPresets() {
    try {
      const saved = localStorage.getItem('hybrid_filter_presets');
      if (saved) {
        this._state.presets = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Error cargando presets de filtros:', error);
      this._state.presets = [];
    }
  },

  /**
   * Guarda presets en localStorage
   */
  _savePresets() {
    try {
      localStorage.setItem('hybrid_filter_presets', JSON.stringify(this._state.presets));
    } catch (error) {
      console.warn('Error guardando presets de filtros:', error);
    }
  },

  /**
   * Obtiene estadísticas de los filtros aplicados
   * @param {Array} originalCourses - Lista original de cursos
   * @param {Array} filteredCourses - Lista filtrada de cursos
   * @return {Object} Estadísticas de filtrado
   */
  getFilterStats(originalCourses, filteredCourses) {
    return {
      total: originalCourses.length,
      filtered: filteredCourses.length,
      percentage: originalCourses.length > 0 ? 
        Math.round((filteredCourses.length / originalCourses.length) * 100) : 0,
      activeFilters: this._getActiveFiltersCount()
    };
  },

  /**
   * Cuenta el número de filtros activos
   * @return {Number} Número de filtros activos
   */
  _getActiveFiltersCount() {
    let count = 0;
    const filters = this._state.currentFilters;
    
    if (filters.text && filters.text.trim()) count++;
    if (filters.subject && filters.subject.trim()) count++;
    if (filters.campus && filters.campus.trim()) count++;
    if (filters.availability !== 'all') count++;
    if (filters.professor && filters.professor.trim()) count++;
    if (filters.schedule.days.length > 0) count++;
    if (filters.schedule.timeRange.start && filters.schedule.timeRange.end) count++;
    
    return count;
  }
};